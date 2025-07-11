from rest_framework import serializers
from django.contrib.auth.models import User
from datetime import datetime, time
from django.utils import timezone
from .models import Attendance, DailyWorkReport, AdminReply
from django.utils import timezone

class UserSearchSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for user search results
    """
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='email')
    status = serializers.CharField(source='get_status_display')
    report_status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'status', 'report_status']
    
    def get_name(self, obj):
        return obj.get_full_name()
    
    def get_report_status(self, obj):
        today = timezone.now().date()
        try:
            report = DailyWorkReport.objects.get(
                user=obj,
                date=today
            )
            return 'sent'
        except DailyWorkReport.DoesNotExist:
            return 'pending'





class AdminReplySerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source='admin.get_full_name', read_only=True)
    
    class Meta:
        model = AdminReply
        fields = ['id', 'message', 'admin', 'admin_name', 'created_at', 'updated_at']
        read_only_fields = ['admin', 'created_at', 'updated_at']


class DailyWorkReportSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    replies = AdminReplySerializer(many=True, read_only=True)
    
    class Meta:
        model = DailyWorkReport
        fields = [
            'id', 'user', 'user_email', 'user_name', 'date', 
            'work_details', 'status', 'admin_reply', 'replied_at', 'replied_by',
            'replies', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'user', 'created_at', 'updated_at', 'replies'
        ]
        extra_kwargs = {
            'date': {'required': True},
            'work_details': {'required': True}
        }


class UserSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'user_id')

    def get_user_id(self, obj):
        try:
            return None
        except Exception as e:
            return None




class ReportSerializer(serializers.ModelSerializer):
    """
    Serializer for user data including daily report status
    """
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email')
    login_time = serializers.SerializerMethodField()
    logout_time = serializers.SerializerMethodField()
    hours_worked = serializers.SerializerMethodField()
    status = serializers.CharField(source='get_status_display')
    daily_report = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'login_time', 'logout_time', 
                 'hours_worked', 'status', 'daily_report']
    
    def get_name(self, obj):
        return obj.get_full_name()
    
    def get_login_time(self, obj):
        return None
    
    def get_logout_time(self, obj):
        return None
    
    def get_hours_worked(self, obj):
        return "0.00 hrs"
    
    def get_daily_report(self, obj):
        today = timezone.now().date()
        try:
            report = DailyWorkReport.objects.get(
                user=obj,
                date=today
            )
            return {
                'status': report.status,
                'submitted_at': report.created_at.strftime('%H:%M:%S'),
                'details': report.work_details[:50] + '...' if report.work_details else ''
            }
        except DailyWorkReport.DoesNotExist:
            return {
                'status': 'pending',
                'submitted_at': None,
                'details': None
            }


class AttendancePunchSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    punch_in_time = serializers.SerializerMethodField()
    punch_out_time = serializers.SerializerMethodField()
    hours_worked = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    reason = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'user_name', 'date',
            'punch_in', 'punch_out', 'punch_in_time', 'punch_out_time',
            'is_late', 'hours_worked', 'status', 'reason',
            'created_at'
        ]
        read_only_fields = ['user_name', 'punch_in_time', 'punch_out_time', 'is_late', 'hours_worked', 'created_at', 'status']

    def get_punch_in_time(self, obj):
        if obj.punch_in:
            return obj.punch_in.astimezone(timezone.get_current_timezone()).strftime('%H:%M:%S')
        return None

    def get_punch_out_time(self, obj):
        if obj.punch_out:
            return obj.punch_out.astimezone(timezone.get_current_timezone()).strftime('%H:%M:%S')
        return None

    def get_hours_worked(self, obj):
        if obj.punch_in and obj.punch_out:
            delta = obj.punch_out - obj.punch_in
            hours = delta.total_seconds() / 3600
            return f"{hours:.2f}"
        return "0.00"

    def get_status(self, obj):
        if not obj.punch_in:
            return "Not Punched In"
        if not obj.punch_out:
            return "Punched In"
        return "Punched Out"


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        return data

class LateLoginReasonSerializer(serializers.Serializer):
    """Serializer for late login reasons"""
    id = serializers.IntegerField()
    reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    
    class Meta:
        fields = ['id', 'reason', 'created_at', 'updated_at']


class EmployeeAttendanceHistorySerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email')
    punch_in_time = serializers.SerializerMethodField()
    punch_out_time = serializers.SerializerMethodField()
    hours_worked = serializers.SerializerMethodField()
    punch_in = serializers.DateTimeField(required=False)
    punch_out = serializers.DateTimeField(required=False)
    employee_id = serializers.IntegerField(source='user.id')
    id = serializers.CharField()
    reason = serializers.CharField(required=False)
    lastLogin = serializers.SerializerMethodField()
    lastLogout = serializers.SerializerMethodField()
    hours = serializers.SerializerMethodField()
    status = serializers.CharField()
    dailyReportSent = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id',
            'employee_id',
            'employee_name',
            'email',
            'punch_in',
            'punch_out',
            'punch_in_time',
            'punch_out_time',
            'hours_worked',
            'status',
            'reason',
            'date',
            'lastLogin',
            'lastLogout',
            'hours',
            'dailyReportSent'
        ]

    def get_dailyReportSent(self, obj):
        try:
            # Get today's date
            today = timezone.now().date()
            
            # Get the daily report for this employee today
            report = DailyWorkReport.objects.filter(
                user=obj.user,
                date=today
            ).first()
            
            if report:
                return {
                    'status': report.status,
                    'work_details': report.work_details
                }
            return None
        except Exception as e:
            print(f"Error fetching daily report: {str(e)}")
            return None

    def get_employee_name(self, obj):
        try:
            if obj.user:
                return f"{obj.user.first_name} {obj.user.last_name}"
            else:
                return 'Unknown Employee'
        except Exception as e:
            print(f"Error getting employee name: {str(e)}")
            return 'Unknown Employee'

    def get_lastLogin(self, obj):
        if obj.punch_in:
            return obj.punch_in.strftime('%Y-%m-%d %H:%M:%S')
        return 'No Punch In'

    def get_lastLogout(self, obj):
        if obj.punch_out:
            return obj.punch_out.strftime('%Y-%m-%d %H:%M:%S')
        return 'No Punch Out'

    def get_hours(self, obj):
        if obj.punch_in and obj.punch_out:
            delta = obj.punch_out - obj.punch_in
            hours = delta.total_seconds() / 3600
            minutes = (hours % 1) * 60
            return f"{int(hours)}h {int(minutes)}m"
        return '0h 0m'

    def get_employee_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else ''

    def get_punch_in_time(self, obj):
        if obj.punch_in:
            return obj.punch_in.strftime('%Y-%m-%d %H:%M:%S')
        if obj.status == 'No Punch':
            return None
        return None

    def get_punch_out_time(self, obj):
        if obj.punch_out:
            return obj.punch_out.strftime('%Y-%m-%d %H:%M:%S')
        if obj.status == 'No Punch':
            return None
        return None

    def get_hours_worked(self, obj):
        if obj.punch_in and obj.punch_out:
            delta = obj.punch_out - obj.punch_in
            hours = delta.total_seconds() / 3600
            minutes = (hours % 1) * 60
            return f"{int(hours)}h {int(minutes)}m"
        if obj.status == 'No Punch':
            return '0h 0m'
        return '0h 0m'

    def get_lastLogin(self, obj):
        if obj.punch_in:
            return obj.punch_in.strftime('%Y-%m-%d %H:%M:%S')
        return 'No Punch In'

    def get_lastLogout(self, obj):
        if obj.punch_out:
            return obj.punch_out.strftime('%Y-%m-%d %H:%M:%S')
        return 'No Punch Out'

    def get_hours(self, obj):
        if obj.punch_in and obj.punch_out:
            delta = obj.punch_out - obj.punch_in
            hours = delta.total_seconds() / 3600
            minutes = (hours % 1) * 60
            return f"{int(hours)}h {int(minutes)}m"
        return '0h 0m'

    def get_reason(self, obj):
        if hasattr(obj, 'reason'):
            return obj.reason or 'No Reason Provided'
        return 'No Reason Provided'

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        # Format punch times
        if representation.get('lastLogin'):
            try:
                representation['lastLogin'] = datetime.strptime(representation['lastLogin'], '%Y-%m-%d %H:%M:%S').strftime('%I:%M %p')
            except (ValueError, TypeError):
                representation['lastLogin'] = 'Invalid Time'
        if representation.get('lastLogout'):
            try:
                representation['lastLogout'] = datetime.strptime(representation['lastLogout'], '%Y-%m-%d %H:%M:%S').strftime('%I:%M %p')
            except (ValueError, TypeError):
                representation['lastLogout'] = 'Invalid Time'
        
        # Ensure all fields have proper fallbacks
        if not representation.get('lastLogin'):
            representation['lastLogin'] = 'No Punch In'
        if not representation.get('lastLogout'):
            representation['lastLogout'] = 'No Punch Out'
        if not representation.get('hours'):
            representation['hours'] = '0h 0m'
        if not representation.get('reason'):
            representation['reason'] = 'No Reason Provided'
        if not representation.get('status'):
            representation['status'] = 'No Punch'
        
        return representation

    def get_employee_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}" if obj.user else ''

    def get_punch_in_time(self, obj):
        if obj.punch_in:
            return obj.punch_in.strftime('%Y-%m-%d %H:%M:%S')
        if obj.status == 'No Punch':
            return None
        return None

    def get_punch_out_time(self, obj):
        if obj.punch_out:
            return obj.punch_out.strftime('%Y-%m-%d %H:%M:%S')
        if obj.status == 'No Punch':
            return None
        return None

    def get_hours_worked(self, obj):
        if obj.punch_in and obj.punch_out:
            delta = obj.punch_out - obj.punch_in
            hours = delta.total_seconds() / 3600
            minutes = (hours % 1) * 60
            return f"{int(hours)}h {int(minutes)}m"
        if obj.status == 'No Punch':
            return '0h 0m'
        return '0h 0m'

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Format punch times
        if representation.get('punch_in_time'):
            representation['punch_in_time'] = datetime.strptime(representation['punch_in_time'], '%Y-%m-%d %H:%M:%S').strftime('%I:%M %p')
        if representation.get('punch_out_time'):
            representation['punch_out_time'] = datetime.strptime(representation['punch_out_time'], '%Y-%m-%d %H:%M:%S').strftime('%I:%M %p')
        
        # Ensure reason is always present
        if not representation.get('reason'):
            representation['reason'] = getattr(instance, 'reason', 'No Reason Provided')
        
        # Handle null values for punch times
        if representation.get('punch_in_time') is None:
            representation['punch_in_time'] = '-' if instance.status == 'No Punch' else 'Not Punched In'
        if representation.get('punch_out_time') is None:
            representation['punch_out_time'] = '-' if instance.status == 'No Punch' else 'Not Punched Out'
        
        # Add formatted hours directly
        if representation.get('hours_worked'):
            representation['hours'] = representation['hours_worked']
        else:
            representation['hours'] = '0h 0m'
        
        return representation
