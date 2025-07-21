from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import (
    UserViewSet, 
    DebugEmployees, 
    PasswordResetRequestView, 
    PasswordResetConfirmView,
    ApproveLateLoginView,
    DailyWorkReportViewSet,
    PunchInView, PunchOutView,
    LogoutView,
    AdminDailyReportView,
    AdminEmployeeReportView,
    AdminReplyToReportView,
    EmployeePunchRecordView,
    CheckPunchOutStatusView,
    AdminAttendanceHistoryView,
    UserAdminRepliesView,
    AttendanceReasonListView,AttendanceReasonApprovalView,  
    UserSearchView,
    test_email
)

# Import new auth views
from .views_auth import (
    UserRegisterView,
    UserLoginView,
    AdminLoginView,
    UserProfileView,
    UserListView,
    
)
from .views_chat import ChatRoomViewSet, UserStatusViewSet, UserListView, websocket_urlpatterns, MessageCreateView, get_room_messages, UserChatRoomsView, RoomMessagesView

router = DefaultRouter()
router.register(r'employees', UserViewSet, basename='employee')
router.register(r'daily-work-reports', DailyWorkReportViewSet, basename='daily-work-report')

# Chat endpoints
router.register(r'chat/rooms', ChatRoomViewSet, basename='chat-room')
router.register(r'chat/status', UserStatusViewSet, basename='user-status')

def debug_punchin(request, employee_id):
    return JsonResponse({"status": "URL matched", "employee_id": employee_id})

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Search endpoint with a unique path
    path('search-employees/', UserSearchView.as_view(), name='employee-search'),
    
    # Authentication endpoints
    path('auth/register/', UserRegisterView.as_view(), name='auth_register'),
    path('auth/login/user/', UserLoginView.as_view(), name='user_login'),
    path('auth/login/admin/', AdminLoginView.as_view(), name='admin_login'),
    path('auth/me/', UserProfileView.as_view(), name='user_profile'),
    path('auth/users/', UserListView.as_view(), name='user_list'),
    
    # Token endpoints
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    
    # Late login approval
    path('late-login-reasons/<int:reason_id>/approve/', ApproveLateLoginView.as_view(), name='approve-late-login'),
    
    # Debug endpoints
    path('debug/employees/', DebugEmployees.as_view(), name='debug-employees'),
    path('debug/test-email/', test_email, name='test-email'),
    
    # Employee endpoints
    path('employees/summary/', UserViewSet.as_view({'get': 'summary'}), name='employee-summary'),
    path('employees/today/', UserViewSet.as_view({'get': 'today_attendance'}), name='today-attendance'),
    path('employees/<int:pk>/login/', UserViewSet.as_view({'post': 'login'}), name='employee-login'),
    path('employees/<int:pk>/logout/', UserViewSet.as_view({'post': 'logout'}), name='employee-logout'),
    path('employees/<int:pk>/status/', UserViewSet.as_view({'post': 'update_status'}), name='update-status'),
    path('users/', UserListView.as_view(), name='user-list'),

    # Chat endpoints
    path('chat/rooms/<int:pk>/messages/', ChatRoomViewSet.as_view({'get': 'messages'}), name='chat-messages'),
    path('chat/status/update/', UserStatusViewSet.as_view({'post': 'update_status'}), name='update-chat-status'),
    path('chat/', include(websocket_urlpatterns)),
    path('attendance/admin-replies/<int:user_id>/', UserAdminRepliesView.as_view(), name='admin-replies-by-user'),
    path('chat/messages/create/', MessageCreateView.as_view(), name='create-message'),
    path('rooms/<int:room_id>/messages/', get_room_messages, name='room-messages'),
    path('chat-rooms/<int:user_id>/', UserChatRoomsView.as_view(), name='user-chat-rooms'),
    path('chat-rooms/<int:room_id>/messages/', RoomMessagesView.as_view(), name='room-messages'),

    # Admin reports and replies
    path('admin/reports/employees/', AdminEmployeeReportView.as_view(), name='admin-employee-reports'),
    path('admin/reports/daily/', AdminDailyReportView.as_view(), name='admin-daily-reports'),
    path('admin/reports/<int:report_id>/reply/', AdminReplyToReportView.as_view(), name='admin-reply-to-report'),
    path('admin/attendance/history/', AdminAttendanceHistoryView.as_view(), name='admin-attendance-history'),
    path('admin/attendance/late-login-reasons/', AttendanceReasonListView.as_view(), name='admin-late-login-reasons'),
    
    # Punch in/out
    path('attendance/punch-in/<int:user_id>/', PunchInView.as_view(), name='punch-in'),
    path('attendance/punch-out/<int:user_id>/', PunchOutView.as_view(), name='punch-out'),
    path('attendance/check-punch-out/<int:user_id>/', CheckPunchOutStatusView.as_view(), name='check-punch-out'),
    path('attendance/punch-records/<int:user_id>/', EmployeePunchRecordView.as_view(), name='employee-punch-records'),
    path('attendance/approve-reason/<int:pk>/', AttendanceReasonApprovalView.as_view(), name='approve-reason'),

    
    # Password Reset URLs
    path('auth/password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('auth/reset-password/<str:token>/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('attendance/debug/<int:user_id>/', debug_punchin),
]