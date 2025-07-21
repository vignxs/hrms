from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q, Count, Case, When, IntegerField
from .models_chat import ChatRoom, Message, UserStatus
from .serializers_chat import ChatRoomSerializer, MessageSerializer, UserSerializer, UserListSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.generics import ListAPIView

User = get_user_model()
class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Disable pagination

    def get_queryset(self):
        return ChatRoom.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages').order_by('-updated_at')

    def get_serializer_context(self):
        return {'request': self.request}

    def perform_create(self, serializer):
        # Get participant IDs from request and ensure they're integers
        participant_ids = list(map(int, self.request.data.get("participants", [])))
        print(f"[DEBUG] Initial participant IDs from request: {participant_ids}")

        # Add current user if not already in the list
        current_user_id = self.request.user.id
        if current_user_id not in participant_ids:
            print(f"[DEBUG] Adding current user {current_user_id} to participants")
            participant_ids.append(current_user_id)

        # Create a set to remove any duplicates
        participant_ids_set = set(participant_ids)
        print(f"[DEBUG] Final participant set: {participant_ids_set}")

        room_type = "group" if len(participant_ids_set) > 2 else "direct"
        print(f"[DEBUG] Room type: {room_type}")

        # Filter candidate rooms with matching participant count and type
        possible_rooms = ChatRoom.objects.annotate(
            num_participants=Count('participants')
        ).filter(
            room_type=room_type,
            num_participants=len(participant_ids_set)
        )

        # Strictly compare participant sets
        print(f"[DEBUG] Looking for existing room with participants: {participant_ids_set}")
        for room in possible_rooms:
            existing_ids = set(room.participants.values_list("id", flat=True))
            print(f"[DEBUG] Comparing with room {room.id} participants: {existing_ids}")
            if existing_ids == participant_ids_set:
                print(f"[DEBUG] Found matching room: {room.id}")
                self.existing_room = room
                return  # Match found
        
        print("[DEBUG] No existing room found with matching participants")

        # No duplicate found — create new
        chat_room = serializer.save(
            created_by=self.request.user,
            room_type=room_type
        )
        print(f"[DEBUG] Creating new chat room with participants: {participant_ids_set}")
        chat_room.participants.set(participant_ids_set)
        self.existing_room = None


 
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.perform_create(serializer)

        if self.existing_room:
            # If an existing room was found, return it with 200 OK
            existing_serializer = self.get_serializer(self.existing_room)
            return Response(existing_serializer.data, status=status.HTTP_200_OK)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
            chat_room = self.get_object()
            messages = chat_room.messages.all().select_related('sender')
            serializer = MessageSerializer(messages, many=True, context={'request': request})
            return Response(serializer.data)


class UserStatusViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get online status of users"""
        user_ids = request.query_params.get('user_ids', '').split(',')
        if user_ids == ['']:
            return Response({"detail": "No user_ids provided"}, status=400)
            
        statuses = UserStatus.objects.filter(user_id__in=user_ids)
        data = {
            str(status.user_id): {
                'is_online': status.is_online,
                'last_seen': status.last_seen
            }
            for status in statuses
        }
        return Response(data)
    
    @action(detail=False, methods=['post'])
    def update_status(self, request):
        """Update user's online status"""
        is_online = request.data.get('is_online', False)
        user_status, _ = UserStatus.objects.get_or_create(user=request.user)
        user_status.is_online = is_online
        user_status.save()
        return Response({"status": "success"})

# WebSocket URL routing
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<room_id>\w+)/$', consumers.ChatConsumer.as_asgi()),
]

class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('id')  # add ordering to avoid warning
    serializer_class = UserListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None   


class MessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        print("Request data:", request.data)  # Debug log
        
        data = request.data.copy()
        recipient_id = data.pop('recipient_id', None)
        
        # If recipient_id is provided instead of room_id, find or create a direct chat room
        if recipient_id and 'room_id' not in data:
            try:
                # Get the other user
                other_user = User.objects.get(id=recipient_id)
                
                # Find existing direct chat room between these two users
                room = ChatRoom.objects.filter(
                    room_type='direct',
                    participants=request.user
                ).filter(
                    participants=other_user
                ).annotate(
                    num_participants=Count('participants')
                ).filter(num_participants=2).first()
                
                if not room:
                    room = ChatRoom.objects.create(
                        room_type='direct',
                        created_by=request.user
                    )
                    room.participants.add(request.user, other_user)
                
                data['room_id'] = room.id
            except User.DoesNotExist:
                return Response(
                    {'error': 'Recipient not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
    
        serializer = MessageSerializer(
            data=data, 
            context={'request': request, 'sender': request.user}
        )
        
        if serializer.is_valid():
            message = serializer.save()  
            response_data = MessageSerializer(
                message, 
                context={'request': request}
            ).data
            print("Message created successfully:", response_data)
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        print("Validation errors:", serializer.errors)
        return Response({
            'status': 'error',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class UserChatRoomsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        rooms = ChatRoom.objects.filter(participants__id=user_id).distinct()
        serializer = ChatRoomSerializer(rooms, many=True)
        return Response(serializer.data)

class RoomMessagesView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        return Message.objects.filter(room_id=room_id).select_related('sender')

@api_view(['GET'])
def get_room_messages(request, room_id):
    print(f"DEBUG: Fetching messages for room {room_id}")
    messages = Message.objects.filter(room_id=room_id).order_by('timestamp')
    print(f"DEBUG: Found {messages.count()} messages")
    serializer = MessageSerializer(messages, many=True)
    print("DEBUG: Serialized data:", serializer.data)
    return Response(serializer.data)
