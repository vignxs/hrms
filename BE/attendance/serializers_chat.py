from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models_chat import ChatRoom, Message, UserStatus
from rest_framework.views import APIView
from rest_framework import permissions, status

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'status']
        read_only_fields = ['email', 'first_name', 'last_name']
    
    def get_status(self, obj):
        try:
            return 'online' if obj.chat_status.is_online else 'offline'
        except UserStatus.DoesNotExist:
            return 'offline'

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    is_me = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=ChatRoom.objects.all(), source='room', write_only=True
    )

    class Meta:
        model = Message
        fields = ['id', 'sender', 'room_id', 'content', 'timestamp', 'is_read', 'is_me']
        read_only_fields = ['id', 'timestamp', 'is_read', 'is_me', 'sender']

    def get_is_me(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.sender == request.user
        return False
        
    def get_is_read(self, obj):
        # For now, we'll return False as we don't have read receipts implemented yet
        # In a real implementation, you would check if the message has been read by the current user
        return False

    def create(self, validated_data):
        request = self.context.get('request')
        user = self.context.get('sender')  # Get sender from context
        if not user and request:
            user = request.user
            
        if not user:
            raise serializers.ValidationError("Sender not specified")
            
        message = Message.objects.create(sender=user, **validated_data)
        return message

class MessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MessageSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            message = serializer.save()
            return Response(MessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChatRoomSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            'id',
            'room_type',
            'name',
            'other_user',
            'created_by',
            'created_at',
            'updated_at',
            'last_message',
            'unread_count'
        ]

    def get_other_user(self, obj):
        request = self.context.get('request')
        if obj.room_type == 'direct' and request and request.user.is_authenticated:
            try:
                others = obj.participants.exclude(id=request.user.id)
                if others.exists():
                    return UserSerializer(others.first(), context=self.context).data
            except:
                pass
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-timestamp').first()
        if last_msg:
            return MessageSerializer(last_msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
            
        # Get all messages in this room not sent by the current user
        # and where the current user hasn't created a read receipt
        return obj.messages.exclude(sender=request.user).exclude(
            read_receipts__user=request.user
        ).count()

class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email'] 
