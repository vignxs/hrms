from rest_framework import viewsets, status, permissions, filters, generics
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.mail import send_mail
from django.utils.dateparse import parse_time  # Add this import for time parsing
from django.conf import settings
from rest_framework.generics import ListAPIView
from django.utils.timezone import now


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def test_email(request):
    """Test email configuration"""
    try:
        send_mail(
            'Test Email',
            'This is a test email from your Django application.',
            settings.DEFAULT_FROM_EMAIL,
            ['shaikhsharim404@gmail.com'],  # Replace with your test email
            fail_silently=False,
        )
        return Response({"message": "Test email sent successfully!"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import ValidationError
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from django.utils import timezone
from datetime import timedelta, datetime, time
from django.urls import reverse
from django.shortcuts import get_object_or_404

from rest_framework import status

User = get_user_model()
from django.db.models import Q, F, ExpressionWrapper, DurationField, Sum
from django.db.models.functions import TruncDate
import secrets
import string
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User, Group
from .models import  DailyWorkReport, AdminReply, Attendance
from .models import PasswordResetToken
from .serializers import (
    UserSerializer, 
    DailyWorkReportSerializer,
    AttendancePunchSerializer,
    UserSearchSerializer,
    AdminReplySerializer, AttendancePunchSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    EmployeeAttendanceHistorySerializer, AttendanceReasonApprovalSerializer
)

from django.utils.dateparse import parse_date
from django.db.models.functions import Now, TruncDate
from django.db.models import Q
import pytz
from rest_framework import generics, permissions, pagination
from rest_framework.pagination import PageNumberPagination
import logging
logger = logging.getLogger(__name__)

class LogoutView(APIView):
    # Disable all authentication and permission checks
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Just return success - tokens will expire naturally
            # If you need token blacklisting, you'll need to:
            # 1. Add 'rest_framework_simplejwt.token_blacklist' to INSTALLED_APPS
            # 2. Run python manage.py migrate
            return Response(
                {"message": "Successfully logged out (token will expire naturally)"}, 
                status=status.HTTP_205_RESET_CONTENT
            )
            
        except Exception as e:
            # Log the error but still return success
            logger.error(f"Error during logout: {str(e)}")
            return Response(
                {"message": "Successfully logged out"}, 
                status=status.HTTP_205_RESET_CONTENT
            )


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        logger.info(f"Login attempt with data: {request.data}")
        email = request.data.get('email')
        default_password =request.data.get("password") #'Pass@123'  # Default password for all users
        
        if not email:
            logger.error("No email provided in request")
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Try to get the user by email
        User = get_user_model()
        try:
            user = User.objects.get(email=email)
            
            # If user exists but authentication fails, update password to default
            if not user.check_password(default_password):
               # user.set_password(default_password)
                return Response({"error": "Invalid Password"}, status=status.HTTP_400_BAD_REQUEST)
                user.save()
                logger.info(f"Password reset to default for user: {email}")
            
            # Now authenticate with default password
            user = authenticate(request, username=email, password=default_password)
            
            if user is not None:
                refresh = RefreshToken.for_user(user)
                logger.info(f"Login successful for user: {email}")
                return Response({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'name': user.get_full_name()
                    }
                })
            
        except User.DoesNotExist:
            logger.warning(f"User not found: {email}")
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        
        logger.warning(f"Login failed for email: {email}")
        return Response({"error": "Login failed"}, status=status.HTTP_401_UNAUTHORIZED)



class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        user = User.objects.filter(email=email).first()

        if not user:
            return Response({'error': 'User with this email does not exist'}, status=400)

        # Delete old tokens for this user (optional but safer)
        PasswordResetToken.objects.filter(user=user).delete()

        # Create new token
        token = get_random_string(48)
        expires_at = timezone.now() + timedelta(hours=24)

        PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )

        reset_url = f"{settings.FRONTEND_URL}/reset-password/{token}/"

        send_mail(
            'Password Reset Request',
            f'Click the link to reset your password: {reset_url}',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )

        return Response({'message': 'Password reset link sent to your email'})

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token, *args, **kwargs):
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({'error': 'New password is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reset_token = PasswordResetToken.objects.get(
                token=token,
                is_used=False,
                expires_at__gt=timezone.now()
            )
        except PasswordResetToken.DoesNotExist:
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        # Update user's password
        user = reset_token.user
        user.set_password(new_password)
        user.save()

        # Mark token as used
        reset_token.mark_as_used()

        return Response({'message': 'Password has been reset successfully'})

 
class ApproveLateLoginView(APIView):
    # permission_classes = [IsAuthenticated]

    def put(self, request, reason_id):
        try:
            # Ensure the logged-in user is allowed to approve this
            print(reason_id)

            approval = AttendanceReasonApproval.objects.get(attendance_id=reason_id)

            # Optional: Only admins or specific roles should approve others' attendance
            print(request.user.is_staff ,request.user.is_superuser)
            if not request.user.is_staff or not request.user.is_superuser:
                return Response(
                    {'error': 'You are not authorized to approve this reason.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            reason_status = request.data.get('status', "")
            if not reason_status :
                return Response(
                    {'error': "'status' field is required (true/false)"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            approval.status = reason_status
            approval.approved_by = request.user
            approval.save()

            return Response({
                'id': approval.id,
                'attendance_id': approval.attendance.id,
                'status': approval.status,
                'approved_by': approval.approved_by.id,
                'message': f'Attendance reason has been {"approved" if approval.status else "rejected"}'
            })

        except AttendanceReasonApproval.DoesNotExist:
            return Response(
                {'error': 'Attendance reason not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error approving attendance reason: {str(e)}")
            return Response(
                {'error': 'Something went wrong while processing your request.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


import logging
logger = logging.getLogger(__name__)

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admin users to perform certain actions.
    - Admin users can perform any action (GET, POST, etc.)
    - Regular users can only create reports (POST)
    """
    def has_permission(self, request, view):
        # Allow all authenticated users to create reports (POST)
        if request.method == 'POST':
            return bool(request.user and request.user.is_authenticated)
        # Only allow admin users for other methods (GET, PUT, DELETE, etc.)
        return bool(request.user and (request.user.is_staff or request.user.is_superuser))


class DailyWorkReportViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing daily work reports.
    - Regular users can submit reports (POST)
    - Only admin users can view all reports (GET)
    """
    serializer_class = DailyWorkReportSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        logger.debug(f"DailyWorkReportViewSet {request.method} accessed by user {request.user.id} (Admin: {request.user.is_staff or request.user.is_superuser}")
    
    def get_queryset(self):
        """
        Return queryset based on user type:
        - Admin: All reports
        - Regular user: Only their own reports
        """
        if self.request.user.is_staff or self.request.user.is_superuser:
            logger.info(f"Admin {self.request.user.id} accessing all daily work reports")
            return DailyWorkReport.objects.all()\
                .select_related('user')\
                .order_by('-date')
        
        logger.info(f"User {self.request.user.id} accessing their own daily work reports")
        return DailyWorkReport.objects.filter(
            user=self.request.user
        ).order_by('-date')
    
    def list(self, request, *args, **kwargs):
        """
        List daily work reports.
        - Admin: All reports
        - Regular users: Only their own reports
        """
        try:
            queryset = self.filter_queryset(self.get_queryset())
            
            # Add pagination
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'count': queryset.count(),
                'results': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error listing daily work reports: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while retrieving the reports"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def partial_update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            if not (request.user.is_staff or request.user.is_superuser):
                return Response(
                    {"error": "Only admin users can update replies."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Allow updating only the reply-related fields
            allowed_fields = ['replied_by_id', 'replied_at', 'admin_reply']
            data = {field: request.data.get(field) for field in allowed_fields if field in request.data}

            # Auto-set replied_by_id and replied_at if admin_reply is sent
            if data.get('admin_reply') and not data.get('replied_by_id'):
                data['replied_by_id'] = request.user.id
            if data.get('admin_reply') and not data.get('replied_at'):
                data['replied_at'] = now()

            serializer = self.get_serializer(instance, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            return Response(serializer.data)

        except Exception as e:
            logger.error(f"Error updating admin reply: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to update admin reply."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def create(self, request, *args, **kwargs):
        try:
            logger.debug(f"Creating daily work report for user {request.user.id}")
            
            # Prepare data with the authenticated user's ID
            data = request.data.copy()
            data['user'] = request.user.id
            
            # Parse the date from request or use today's date
            report_date = None
            if 'date' in data and data['date']:
                try:
                    report_date = parse_date(data['date'])
                    if not report_date:
                        raise ValueError("Invalid date format")
                except (ValueError, TypeError):
                    return Response(
                        {"date": ["Invalid date format. Use YYYY-MM-DD."]},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                report_date = timezone.now().date()
                data['date'] = report_date.isoformat()
            
            # Check if a report already exists for this user and date
            existing_report = DailyWorkReport.objects.filter(
                user=request.user,
                date=report_date
            ).first()
            
            if existing_report:
                logger.warning(f"Daily work report already exists for user {request.user.id} on {report_date}")
                return Response(
                    {
                        "error": "A daily work report already exists for this date.",
                        "existing_report_id": existing_report.id,
                        "date": existing_report.date.isoformat(),
                        "status": existing_report.status
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate work_details is provided and not empty
            work_details = data.get('work_details', '').strip()
            if not work_details:
                logger.warning(f"Missing work_details in request from user {request.user.id}")
                return Response(
                    {"work_details": ["This field is required."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the report
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            
            # Save the report with the employee and status
            try:
                self.perform_create(serializer)
                logger.info(f"Daily work report created successfully for user {request.user.id}")
                
                headers = self.get_success_headers(serializer.data)
                return Response(
                    serializer.data, 
                    status=status.HTTP_201_CREATED, 
                    headers=headers
                )
                
            except Exception as e:
                logger.error(f"Error saving daily work report for user {request.user.id}: {str(e)}")
                if 'duplicate key' in str(e):
                    return Response(
                        {"error": "A daily work report already exists for this date."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                raise
            
        except Exception as e:
            error_msg = f"Error creating daily work report: {str(e)}"
            logger.error(f"{error_msg}\n{str(e)}", exc_info=True)
            
            if hasattr(e, 'detail') and isinstance(e.detail, dict):
                # Handle DRF validation errors
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
                
            return Response(
                {"error": "An error occurred while creating the report. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        # Set status to 'sent' when report is submitted
        serializer.save(user=self.request.user, status='sent')


class DebugEmployees(APIView):
    permission_classes = []
    authentication_classes = []
    
    def get(self, request, *args, **kwargs):
        """Debug endpoint to list all employees"""
        try:
            employees = User.objects.all().values('id', 'email', 'status')
            return Response({
                'count': employees.count(),
                'employees': list(employees)
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'type': type(e).__name__
            }, status=500)

# Function-based view for the debug endpoint
debug_employees = DebugEmployees.as_view()


class AdminEmployeeReportView(APIView):
    """
    Admin-only API endpoint to view all employees with their attendance and daily report status.
    
    This view is restricted to admin users only and provides a comprehensive overview
    of employee activities including login/logout times and daily report submissions.
    
    Authentication: JWT Token Required
    Permissions: Staff or Superuser
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Get a list of all employees with their daily report status
        
        Returns:
            - 200: JSON response with employee data and report status
            - 403: If user is not an admin
            - 500: For any server errors
        """
        try:
            # Check if user is admin (staff or superuser)
            if not (request.user.is_staff or request.user.is_superuser):
                logger.warning(f"Unauthorized access attempt by user {request.user.id}")
                return Response(
                    {
                        "error": "Access Denied",
                        "message": "You do not have permission to access this resource"
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"Admin report accessed by user {request.user.id}")
            today = timezone.now().date()
            
            # Get all active employees with their related user data
            employees = User.objects.filter(
                is_active=True
            ).select_related('user').order_by('user__first_name', 'user__last_name')
            
            if not employees.exists():
                return Response({
                    'date': today.isoformat(),
                    'count': 0,
                    'reports': [],
                    'message': 'No active employees found'
                })
            
            # Get all reports for today with related employee data
            today_reports = DailyWorkReport.objects.filter(
                date=today
            ).select_related('user')
            
            # Create a dictionary of employee_id -> report status for quick lookup
            report_status = {}
            for report in today_reports:
                report_status[report.user_id] = {
                    'status': report.status,
                    'submitted_at': report.created_at,
                    'work_details': report.work_details[:100] + '...' if report.work_details else '',
                    'report_id': report.id
                }
            
            # Prepare response data with employee information
            result = []
            for employee in employees:
                # Skip if employee has no associated user
                if not hasattr(employee, 'user'):
                    continue
                    
                employee_data = {
                    'employee_id': employee.id,
                    'user_id': employee.id,
                    'first_name': employee.first_name,
                    'last_name': employee.last_name,
                    'email': employee.email,
                    'status': employee.status or 'inactive',
                    'login_time': employee.last_login.isoformat() if employee.last_login else None,
                    'logout_time': None,
                    'last_login': employee.last_login.isoformat() if employee.last_login else None,
                    'daily_report': {
                        'status': 'pending',  # Default status
                        'submitted_at': None,
                        'work_details': None,
                        'report_id': None
                    }
                }
                
                # Update with report status if exists
                if employee.id in report_status:
                    employee_data['daily_report'] = {
                        'status': report_status[employee.id]['status'],
                        'submitted_at': report_status[employee.id]['submitted_at'].isoformat() if report_status[employee.id]['submitted_at'] else None,
                        'work_details': report_status[employee.id]['work_details'],
                        'report_id': report_status[employee.id]['report_id']
                    }
                    
                result.append(employee_data)
            
            return Response({
                'date': today.isoformat(),
                'count': len(result),
                'reports': result,
                'message': 'Successfully retrieved employee reports'
            })
            
        except Exception as e:
            logger.error(f"Error in AdminEmployeeReportView: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Internal Server Error',
                    'message': 'An error occurred while processing your request',
                    'details': str(e) if settings.DEBUG else None
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

class UserSearchView(APIView):
    """
    API endpoint for searching employees by name and filtering by report status
    """
    permission_classes = []
    authentication_classes = []
    
    def get(self, request):
        try:
            print("\n=== EmployeeSearchView Called ===")
            print("Request URL:", request.build_absolute_uri())
            print("Query Params:", dict(request.query_params))
            print("Request Method:", request.method)
            print("Request Headers:", dict(request.headers))
            print("=" * 50 + "\n")
            
            # Get query parameters
            search_query = request.query_params.get('search', '').strip()
            status_filter = request.query_params.get('status', '').lower()
            
            # Start with all employees
            users = User.objects.select_related('user').all()
            print(f"Total employees: {users.count()}")
            
            # Apply search filter (name or email)
            if search_query:
                print(f"Applying search filter: {search_query}")
                users = users.filter(
                    Q(first_name__icontains=search_query) |
                    Q(last_name__icontains=search_query) |
                    Q(email__icontains=search_query)
                )
                print(f"Users after search: {users.count()}")
            
            # Apply status filter
            if status_filter in ['sent', 'pending']:
                print(f"Applying status filter: {status_filter}")
                today = timezone.now().date()
                if status_filter == 'sent':
                    # Get employees who have submitted reports today
                    employees_with_reports = DailyWorkReport.objects.filter(
                        date=today
                    ).values_list('user_id', flat=True)
                    users = users.filter(id__in=employees_with_reports)
                else:  # pending
                    # Get employees who haven't submitted reports today
                    employees_with_reports = DailyWorkReport.objects.filter(
                        date=today
                    ).values_list('user_id', flat=True)
                    users = users.exclude(id__in=employees_with_reports)
                print(f"Employees after status filter: {users.count()}")
            
            # Serialize the results
            serializer = UserSerializer(users, many=True)
            
            return Response({
                'count': users.count(),
                'results': serializer.data
            })
            
        except Exception as e:
            print(f"Error in UserSearchView: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class AdminAttendanceView(ListAPIView):
    """
    Admin-only view to list all punch-in and punch-out records.
    Optional filters: ?user_id=123, ?date=2025-07-10
    """
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendancePunchSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['user', 'date']
    ordering_fields = ['date', 'created_at']
    search_fields = ['user__first_name', 'user__last_name', 'user__email']

class AdminReplyView(APIView):
    """
    API endpoint for posting replies to daily work reports
    Only accessible by admin users
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, report_id):
        # Check if user is admin
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"error": "You do not have permission to access this resource"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        try:
            # Get the report with related employee data
            report = DailyWorkReport.objects.select_related('user').get(id=report_id)
        except DailyWorkReport.DoesNotExist:
            return Response(
                {"error": "Daily work report not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate request data
        serializer = AdminReplySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Update the report with admin's reply
            report.admin_reply = serializer.validated_data.get('message')
            report.replied_by = request.user  # Current admin user
            report.replied_at = timezone.now()
            report.save()
            
            # Create a new reply record
            reply = AdminReply.objects.create(
                report=report,
                admin=request.user,
                message=serializer.validated_data['message']
            )
            
            # Prepare email content
            employee_email = report.user.email
            employee_name = report.get_full_name() or 'Employee'
            subject = f"Reply to your daily report - {report.date}"
            
            message = f"""
            Hello {employee_name},
            
            You have received a reply from the admin regarding your daily work report for {report.date}.
            
            Your Work Details:
            {report.work_details}
            
            Admin's Reply:
            {report.admin_reply}
            
            Regards,
            Admin Team
            """
            
            # Send email to employee
            try:
                send_mail(
                    subject=subject,
                    message=message.strip(),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[employee_email],
                    fail_silently=False,
                )
                logger.info(f"Reply email sent to {employee_email}")
            except Exception as e:
                logger.error(f"Failed to send email to {employee_email}: {str(e)}")
            
            # Return the reply data
            return Response({
                'id': reply.id,
                'report_id': report.id,
                'admin_name': request.user.get_full_name() or 'Admin',
                'message': reply.message,
                'created_at': reply.created_at,
                'email_sent': True,
                'employee_email': employee_email
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating admin reply: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EmployeePunchRecordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user_tz = pytz.timezone('Asia/Kolkata')
            now = timezone.now().astimezone(user_tz)
            today = now.date()
            
            # Get today's attendance record
            today_record = Attendance.objects.filter(
                user=user,
                date=today
            ).first()
            
            # Get all records for this user
            all_records = Attendance.objects.filter(user=user).order_by('-date')
            
            # Check punch-in/punch-out status for today
            has_punched_in = today_record and today_record.punch_in is not None
            has_punched_out = today_record and today_record.punch_out is not None
            
            # Get today's hours worked if punched out
            hours_worked = None
            if has_punched_in and has_punched_out:
                hours_worked = (today_record.punch_out - today_record.punch_in).total_seconds() / 3600
            
            # Process records for timezone conversion
            formatted_records = []
            for record in all_records:
                formatted_records.append({
                    'id': record.id,
                    'date': record.date,
                    'punch_in': record.punch_in.astimezone(user_tz) if record.punch_in else None,
                    'punch_out': record.punch_out.astimezone(user_tz) if record.punch_out else None,
                    'user_name': record.user.get_full_name(),
                    'status': record.status,
                    'punch_in_reason': record.punch_in_reason,  # Fixed field name
                    'punch_out_reason': record.punch_out_reason,  # Fixed field name
                    'punch_in_reason_status': record.punch_in_reason_status,  # Fixed field name
                    'punch_out_reason_status': record.punch_out_reason_status,  # Fixed field name
                    'created_at': record.created_at.astimezone(user_tz) if record.created_at else None
                })
            
            return Response({
                "user": {
                    "id": user.id,
                    "email": user.email
                },
                "today": {
                    "date": today,
                    "has_punched_in": has_punched_in,
                    "has_punched_out": has_punched_out,
                    "hours_worked": hours_worked,
                    "status": today_record.status if today_record else None,
                    "punch_in_reason": today_record.punch_in_reason if today_record else None,
                    "punch_in_reason_status": today_record.punch_in_reason_status if today_record else None,
                    "punch_out_reason": today_record.punch_out_reason if today_record else None,
                    "punch_out_reason_status": today_record.punch_out_reason_status if today_record else None,
                    "punch_in_time": today_record.punch_in.astimezone(user_tz) if has_punched_in else None,
                    "punch_out_time": today_record.punch_out.astimezone(user_tz) if has_punched_out else None
                },
                "records": formatted_records
            })
            
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in EmployeePunchRecordView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PunchInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user_tz = pytz.timezone('Asia/Kolkata')
            now = timezone.now().astimezone(user_tz)
            today = now.date()

            existing = Attendance.objects.filter(user=user, date=today).first()
            if existing and existing.punch_in:
                return Response({"error": "Already punched in today"}, status=status.HTTP_400_BAD_REQUEST)

            reason = request.data.get('punch_in_reason', '').strip()  
            late_time = user_tz.localize(datetime.combine(today, time(9, 30)))
            is_late = now > late_time

            if is_late and not reason:
                return Response({"error": "Late login! Reason required after 9:30 AM."}, status=status.HTTP_400_BAD_REQUEST)

            attendance = existing if existing else Attendance(user=user, date=today)
            attendance.punch_in = now
            attendance.punch_in_time = now.strftime('%I:%M %p')

            if is_late:
                attendance.punch_in_reason = reason
                attendance.punch_in_reason_status = 'pending'

            attendance.status = 'Present'
            attendance.save()

            return Response(AttendancePunchSerializer(attendance).data, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PunchOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user_tz = pytz.timezone('Asia/Kolkata')
            now = timezone.now().astimezone(user_tz)
            today = now.date()

            record = Attendance.objects.filter(user=user, date=today, punch_out__isnull=True).first()
            if not record or not record.punch_in:
                return Response({"error": "No punch-in record found for today"}, status=status.HTTP_400_BAD_REQUEST)

            reason = request.data.get('punch_out_reason', '').strip()  
            early_departure_time = user_tz.localize(datetime.combine(today, time(18, 30)))
            is_early_departure = now < early_departure_time

            if is_early_departure and not reason:
                return Response({"error": "Early departure! Reason required before 6:30 PM."}, status=status.HTTP_400_BAD_REQUEST)

            record.punch_out = now
            record.punch_out_time = now.strftime('%I:%M %p')

            # Calculate hours worked
            if record.punch_in and record.punch_out:
                delta = record.punch_out - record.punch_in
                hours = int(delta.total_seconds() // 3600)
                minutes = int((delta.total_seconds() % 3600) // 60)
                record.hours_worked = f"{hours}h {minutes}m"

            if is_early_departure:
                record.punch_out_reason = reason
                record.punch_out_reason_status = 'pending'

            record.status = 'Present'
            record.save()

            return Response(AttendancePunchSerializer(record).data, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

import logging

logger = logging.getLogger(__name__)
class UserAdminRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        reports = DailyWorkReport.objects.filter(user_id=user_id)

        data = []
        for report in reports:
            if report.admin_reply:  # Only include if there's an admin reply
                data.append({
                    "report_id": report.id,
                    "date": report.date,
                    "status": report.status,
                    "work_details": report.work_details[:100] + '...' if report.work_details else '',
                    "admin_reply": report.admin_reply,
                    "replied_by": report.replied_by.get_full_name() if report.replied_by else None,
                    "replied_at": report.replied_at
                })
        print(data)

        return Response(data, status=status.HTTP_200_OK)
    
class PunchRecordsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            # Get current time in user's timezone
            user_tz = pytz.timezone('Asia/Kolkata')
            now = timezone.now().astimezone(user_tz)
            today = now.date()
            
            # Get attendance records for today
            records = Attendance.objects.filter(
                user=user,
                date=today
            ).order_by('-created_at')
            
            serializer = AttendancePunchSerializer(records, many=True)
            
            return Response({
                'user_id': user_id,
                'date': today,
                'records': serializer.data
            })
            
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)



class AdminReplyToReportView(APIView):
    """
    API endpoint for admins to post replies to daily work reports
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, report_id):
        # Check if user is admin
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"error": "Only admin users can post replies"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        try:
            # Get the report
            report = DailyWorkReport.objects.get(id=report_id)
        except DailyWorkReport.DoesNotExist:
            return Response(
                {"error": "Report not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate request data
        message = request.data.get('message', '').strip()
        if not message:
            return Response(
                {"message": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.admin_reply = message
        report.replied_at = timezone.now()
        report.replied_by = request.user
        report.save()

        # Log the action
        logger.info(f"Admin {request.user.id} replied to report {report_id}")

        # Optional: return updated report data (if needed)
        return Response({"detail": "Reply added successfully."}, status=status.HTTP_201_CREATED)


class ReportRepliesView(APIView):
    """
    API endpoint for employees to view replies to their reports
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, report_id=None):
        try:
            # Get the employee for the current user
            user = User.objects.get(id=request.user.id)
            
            # Get the report and verify ownership
            report = DailyWorkReport.objects.get(
                id=report_id,
                user=user
            )
            
            # Mark any unread replies as read
            report.replies.filter(is_read=False).update(is_read=True)
            
            # Get all replies for this report
            replies = report.replies.all().order_by('created_at')
            serializer = AdminReplySerializer(replies, many=True)
            
            # Prepare response data
            response_data = {
                'report_id': report.id,
                'date': report.date,
                'work_details': report.work_details,
                'replies': serializer.data
            }
            
            return Response(response_data)
            
        except User.DoesNotExist:
            return Response(
                {"error": "Employee profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DailyWorkReport.DoesNotExist:
            return Response(
                {"error": "Report not found or you don't have permission to view it"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error fetching report replies: {str(e)}")
            return Response(
                {"error": "An error occurred while fetching report replies"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminDailyReportView(APIView):
    """
    View to see daily work reports with two tabs: Sent and Pending
    """
    permission_classes = []
    authentication_classes = []  # Disable all authentication
    
    def get(self, request):
        # Get today's date
        today = timezone.now().date()
        
        # Get all reports for today, ordered by creation time (newest first)
        reports = DailyWorkReport.objects.filter(date=today).order_by('-created_at')
        
        # Get pending and sent reports
        pending_reports = reports.filter(status='pending')
        sent_reports = reports.filter(status='sent')
        
        # Serialize the data
        pending_serializer = DailyWorkReportSerializer(
            pending_reports, 
            many=True,
            context={'request': request}
        )
        
        sent_serializer = DailyWorkReportSerializer(
            sent_reports,
            many=True,
            context={'request': request}
        )
        
        # Prepare response data
        response_data = {
            'pending': {
                'count': pending_reports.count(),
                'reports': pending_serializer.data
            },
            'sent': {
                'count': sent_reports.count(),
                'reports': sent_serializer.data
            }
        }
        
        return Response(response_data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    authentication_classes = []
    permission_classes = []
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'last_login', 'hours_worked', 'status']
    
    def get_permissions(self):
        # Completely disable permission checks
        return []
        
    def get_authenticators(self):
        # Disable authentication
        return []

    @action(detail=False, methods=['get'])
    def today_attendance(self, request):
        """
        Get today's attendance for all employees
        Returns:
            List of employees with their login/logout times and hours worked today
        """
        try:
            today = timezone.now().date()
            today_logs = []
            
            # Get all employees
            employees = self.get_queryset()
            
            if not employees.exists():
                return Response({"detail": "No employees found"}, status=status.HTTP_404_NOT_FOUND)
            
            for employee in employees:
                # Initialize with default values
                login_time = None
                logout_time = None
                hours_worked = 0.0
                
                # Try to get login/logout times if they exist
                try:
                    # Get today's login
                    login = employee.attendance_logs.filter(
                        event_type='login',
                        timestamp__date=today
                    ).order_by('timestamp').first()
                    
                    # Get today's logout
                    logout = employee.attendance_logs.filter(
                        event_type='logout',
                        timestamp__date=today
                    ).order_by('timestamp').last()
                    
                    # Calculate hours worked if both login and logout exist
                    if login and logout:
                        time_diff = logout.timestamp - login.timestamp
                        hours_worked = round(time_diff.total_seconds() / 3600, 2)
                        login_time = login.timestamp
                        logout_time = logout.timestamp
                    elif login:
                        login_time = login.timestamp
                except Exception as e:
                    # Log the error but continue with other employees
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error processing employee {employee.id}: {str(e)}")
                
                today_logs.append({
                    'employee_id': employee.id,
                    'name': employee.get_full_name() if employee else 'No Name',
                    'email': employee.email,
                    'login_time': login_time,
                    'logout_time': logout_time,
                    'hours_worked': hours_worked,
                    'status': employee.status
                })
            
            return Response(today_logs)
            
        except Exception as e:
            return Response(
                {"detail": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_queryset(self):
        queryset = User.objects.all().select_related('user')
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status=status_filter.lower())
            
        # Filter by date
        date = self.request.query_params.get('date')
        if date:
            try:
                date = parse_date(date)
                if date:
                    queryset = queryset.filter(
                        Q(last_login__date=date) | 
                        Q(last_login__date=date)
                    )
            except (ValueError, TypeError):
                pass
        
        # Calculate current hours for online employees
        current_time = timezone.now()
        for employee in queryset.filter(status='online', last_login__isnull=False):
            if employee.last_login:
                hours = (current_time - employee.last_login).total_seconds() / 3600
                employee.hours_worked = round(hours, 2)
                
        return queryset

    @action(detail=True, methods=['post', 'get'])
    def login(self, request, pk=None):
        user = self.get_object()
        
        # Handle GET request - Admin can view login time
        if request.method == 'GET':
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({
                    'success': False,
                    'error': 'You do not have permission to view this information'
                }, status=status.HTTP_403_FORBIDDEN)
                
            attendance_log = AttendancePunchInOut.objects.filter(
                user=user,
                event_type='punch_in'
            ).order_by('-timestamp').first()
            
            if not attendance_log:
                return Response({
                    'success': True,
                    'message': 'No login record found',
                    'data': {
                        'employee_id': user.id,
                        'employee_name': user.get_full_name() if user else 'N/A',
                        'login_time': None,
                        'status': 'Not logged in today'
                    }
                })
                
            return Response({
                'success': True,
                'message': 'Login information retrieved',
                'data': {
                    'employee_id': user.id,
                    'employee_name': user.get_full_name() if user else 'N/A',
                    'login_time': attendance_log.timestamp,
                    'status': user.status,
                    'is_late': attendance_log.is_late,
                    'late_reason': attendance_log.late_reason if attendance_log.is_late else None
                }
            })
            
        # Handle POST request - Record login
        try:
            user.last_login = timezone.now()
            user.save()
            serializer = self.get_serializer(user)
            return Response({
                'success': True,
                'message': 'Login recorded successfully',
                'data': serializer.data
            })
        except ValidationError as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post', 'get'])
    def logout(self, request, pk=None):
        user = self.get_object()
        
        # Handle GET request - Admin can view logout time
        if request.method == 'GET':
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({
                    'success': False,
                    'error': 'You do not have permission to view this information'
                }, status=status.HTTP_403_FORBIDDEN)
                
            # Get the latest punch out record
            attendance_log = AttendancePunchInOut.objects.filter(
                user=user,
                event_type='punch_out'
            ).order_by('-timestamp').first()
            
            if not attendance_log:
                return Response({
                    'success': True,
                    'message': 'No logout record found',
                    'data': {
                        'employee_id': user.id,
                        'employee_name': user.get_full_name() if user else 'N/A',
                        'logout_time': None,
                        'status': 'Not logged out today'
                    }
                })
                
            # Get corresponding punch in for hours worked
            punch_in = AttendancePunchInOut.objects.filter(
                user=user,
                event_type='punch_in',
                timestamp__date=attendance_log.timestamp.date(),
                timestamp__lte=attendance_log.timestamp
            ).order_by('-timestamp').first()
            
            hours_worked = None
            if punch_in:
                time_diff = attendance_log.timestamp - punch_in.timestamp
                hours_worked = round(time_diff.total_seconds() / 3600, 2)  # Convert to hours
            
            return Response({
                'success': True,
                'message': 'Logout information retrieved',
                'data': {
                    'employee_id': user.id,
                    'employee_name': user.get_full_name() if user else 'N/A',
                    'logout_time': attendance_log.timestamp,
                    'hours_worked': hours_worked,
                    'status': user.status
                }
            })
            
        # Handle POST request - Record logout
        try:
            user.last_login = None
            user.save()
            serializer = self.get_serializer(user)
            return Response({
                'success': True,
                'message': 'Logout recorded successfully',
                'data': serializer.data
            })
        except ValidationError as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        user = self.get_object()
        new_status = request.data.get('status')
        
        try:
            user.status = new_status
            user.save()
            return Response({
                'success': True,
                'message': f'Status updated to {new_status}',
                'data': {
                    'status': user.status,
                    'updated_at': user.updated_at
                }
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
            
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary of employee attendance"""
        today = timezone.now().date()
        
        # Get counts for today
        queryset = self.get_queryset()
        total_employees = queryset.count()
        online_count = queryset.filter(status='online').count()
        offline_count = queryset.filter(status='offline').count()
        on_leave_count = queryset.filter(status='leave').count()
        
        # Calculate average working hours for today
        today_employees = queryset.filter(
            last_login__date=today,
            last_login__isnull=False
        )
        
        # Calculate total and average hours
        total_hours = sum(emp.hours_worked for emp in today_employees if emp.hours_worked)
        avg_hours = total_hours / len(today_employees) if today_employees else 0
        
        # Get late comers (logged in after 9:45 AM)
        late_time = timezone.make_aware(datetime.combine(today, time(9, 45)).replace(tzinfo=timezone.get_current_timezone()))
        
        late_comers = queryset.filter(
            last_login__date=today,
            last_login__gt=late_time
        ).count()
        
        return Response({
            'date': today,
            'total_employees': total_employees,
            'online': online_count,
            'offline': offline_count,
            'on_leave': on_leave_count,
            'average_hours_worked': round(avg_hours, 2),
            'late_comers': late_comers

        })


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

# class LogoutView(APIView):
#     permission_classes = (IsAuthenticated,)

#     def post(self, request):
#         try:
#             refresh_token = request.data.get("refresh")
#             token = RefreshToken(refresh_token)
#             token.blacklist()
#             return Response(status=status.HTTP_205_RESET_CONTENT)
#         except Exception as e:
#             return Response(status=status.HTTP_400_BAD_REQUEST)

class CheckPunchOutStatusView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id):
        try:
            today = timezone.now().date()
            # Check if there's any punch-out record for today
            has_punched_out = AttendancePunchInOut.objects.filter(
                user_id=user_id,
                date=today,
                punch_out__isnull=False
            ).exists()
            
            return Response({
                'has_punched_out': has_punched_out,
                'today': today
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime
from django.contrib.auth import get_user_model
from attendance.models import Attendance, DailyWorkReport

User = get_user_model()
class AdminAttendanceHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        today = timezone.localdate()  
        print(f"\nFetching attendance data for {today}")

        employees = User.objects.all().prefetch_related('attendances', 'daily_reports')
        attendance_records = Attendance.objects.filter(date=today)
        daily_reports = DailyWorkReport.objects.filter(date=today)

        print(f"Found {employees.count()} employees")
        print(f"Found {attendance_records.count()} attendance records")
        print(f"Found {daily_reports.count()} daily reports")

        data = []

        for employee in employees:
            attendance = attendance_records.filter(user=employee).first()
            report = daily_reports.filter(user=employee).first()

            user_data = {
                'id': employee.id,
                'first_name': employee.first_name,
                'last_name': employee.last_name,
                'email': employee.email
            }

            attendance_data = {
                'punch_in_time': attendance.punch_in_time if attendance else '',
                'punch_out_time': attendance.punch_out_time if attendance else '',
                'hours_worked': attendance.hours_worked if attendance else '0h 0m',
                'status': attendance.status if attendance else 'No Attendance',
                'punch_in_reason': attendance.punch_in_reason if attendance else '',
                'punch_out_reason': attendance.punch_out_reason if attendance else '',
                'punch_in_reason_status': attendance.punch_in_reason_status if attendance else 'pending',
                'punch_out_reason_status': attendance.punch_out_reason_status if attendance else 'pending',
                'a_id': attendance.id if attendance else "",
                'has_punchout': bool(attendance and attendance.punch_out) if attendance else False,
                'last_login': employee.last_login.isoformat() if employee.last_login else None,
                'created_at': attendance.created_at.isoformat() if attendance and attendance.created_at else None
            }

            if report:
                attendance_data['dailyReportSent'] = {
                    'report_id': report.id,
                    'status': report.status,
                    'work_details': report.work_details
                }
            else:
                attendance_data['dailyReportSent'] = None

            full_data = {**user_data, **attendance_data}
            data.append(full_data)

        # Sort
        data.sort(key=lambda x: (
            x['punch_in_time'] == '',
            x['punch_out_time'] == '',
            x['created_at'] or '',  
            x['first_name']
        ))

        print(f"\nFinal queryset length: {len(data)}")
        print(f"First item structure: {data[0] if data else 'No items'}")
        # print(data)

        return Response({
            'items': data
            
        })


class AttendanceReasonApprovalView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            attendance = Attendance.objects.get(pk=pk)
        except Attendance.DoesNotExist:
            return Response({"error": "Attendance record not found"}, status=status.HTTP_404_NOT_FOUND)

        # Validate required fields
        if 'status' not in request.data:
            return Response({"error": "Status is required"}, status=status.HTTP_400_BAD_REQUEST)
        if 'reason_type' not in request.data:
            return Response({"error": "Reason type is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate status value
        if request.data['status'] not in ['approved', 'rejected']:
            return Response({"error": "Invalid status value. Must be 'approved' or 'rejected'"}, 
                          status=status.HTTP_400_BAD_REQUEST)

        # Validate reason type
        if request.data['reason_type'] not in ['punch_in', 'punch_out']:
            return Response({"error": "Invalid reason type. Must be 'punch_in' or 'punch_out'"}, 
                          status=status.HTTP_400_BAD_REQUEST)

        # Update the appropriate fields based on reason type
        if request.data['reason_type'] == 'punch_in':
            attendance.punch_in_reason_status = request.data['status']
            if 'admin_comment' in request.data:
                attendance.punch_in_admin_comment = request.data['admin_comment']
        else:  # punch_out
            attendance.punch_out_reason_status = request.data['status']
            if 'admin_comment' in request.data:
                attendance.punch_out_admin_comment = request.data['admin_comment']

        attendance.save()
        
        serializer = AttendanceReasonApprovalSerializer(attendance)
        return Response(serializer.data)


class AttendanceReasonListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        today = timezone.localdate()

        # Only get attendance records for today with either reason filled
        records = Attendance.objects.select_related('user').filter(
            date=today
        ).filter(
            Q(punch_in_reason__isnull=False) & ~Q(punch_in_reason__exact='') |
            Q(punch_out_reason__isnull=False) & ~Q(punch_out_reason__exact='')
        )

        data = []

        for record in records:
            data.append({
                "id": record.id,
                "name": record.user.get_full_name(),
                "email": record.user.email,
                "punch_in_time": record.punch_in_time or "",
                "punch_out_time": record.punch_out_time or "",
                "hours": record.hours_worked,
                "punch_in_reason": record.punch_in_reason or "",
                "punch_in_reason_status": record.punch_in_reason_status,
                "punch_out_reason": record.punch_out_reason or "",
                "punch_out_reason_status": record.punch_out_reason_status,
            })

        return Response(data)