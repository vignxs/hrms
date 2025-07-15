from django.db import models
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import datetime, time, timedelta
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
import pytz

@receiver(post_save, sender='attendance.Attendance')
def create_attendance_reason_approval(sender, instance, created, **kwargs):
    """Create or update AttendanceReasonApproval after Attendance is saved"""
    if created and instance.reason and instance.reason.strip():
        approval, created = AttendanceReasonApproval.objects.get_or_create(
            attendance=instance,
            defaults={'status': 'pending'}
        )
        if not created:
            approval.status = 'pending'
            approval.save()


class DailyWorkReport(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_reports')
    date = models.DateField()
    work_details = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    admin_reply = models.TextField(blank=True, null=True)
    replied_at = models.DateTimeField(blank=True, null=True)
    replied_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='replied_reports')

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.date}"


class PasswordResetToken(models.Model):
    """Model to store password reset tokens"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def mark_as_used(self):
        self.is_used = True
        self.save()


class AdminReply(models.Model):
    """
    Model to store admin replies to daily work reports
    """
    report = models.ForeignKey(DailyWorkReport, on_delete=models.CASCADE, related_name='replies')
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='replies_given')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Admin Replies'

    def __str__(self):
        return f"Reply to {self.report} by {self.admin.get_full_name()}"


from django.db import models
from datetime import timedelta


class Attendance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')

    date = models.DateField()
    punch_in = models.DateTimeField(null=True, blank=True)
    punch_out = models.DateTimeField(null=True, blank=True)

    punch_in_time = models.CharField(max_length=20, blank=True)
    punch_out_time = models.CharField(max_length=20, blank=True)

    is_late = models.BooleanField(default=False)

    # 🔽 Separate reasons for punch in and punch out
    punch_in_reason = models.CharField(max_length=255, blank=True, null=True)
    punch_out_reason = models.CharField(max_length=255, blank=True, null=True)

    # 🔽 Separate approval status
    punch_in_reason_status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending')
    punch_out_reason_status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending')

    # Optional admin comments
    punch_in_admin_comment = models.TextField(blank=True, null=True)
    punch_out_admin_comment = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=20, default='Pending')  # general attendance status
    hours_worked = models.CharField(max_length=20, blank=True, default='0h 0m')

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.punch_in and self.punch_out:
            delta = self.punch_out - self.punch_in
            hours = int(delta.total_seconds() // 3600)
            minutes = int((delta.total_seconds() % 3600) // 60)
            self.hours_worked = f"{hours}h {minutes}m"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.date}"
