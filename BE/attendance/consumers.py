import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.apps import apps

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        print("🔁 Incoming WS Message:", text_data)
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        sender_id = text_data_json['sender_id']

        # Save message to database
        message_obj = await self.save_message(message, sender_id)

        if message_obj:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': message_obj.id,
                        'message': message_obj.content,
                        'sender_id': message_obj.sender.id,
                        'room_id': message_obj.room.id,
                        'timestamp': message_obj.timestamp.isoformat()
                    }
                }
            )

    # Receive message from room group
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    @database_sync_to_async
    def save_message(self, content, sender_id):
        ChatRoom = apps.get_model('attendance', 'ChatRoom')
        Message = apps.get_model('attendance', 'Message')
        User = get_user_model()
        
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            sender = User.objects.get(id=sender_id)
            message = Message.objects.create(
                room=room,
                sender=sender,
                content=content
            )
            return message
        except Exception as e:
            print(f"Error saving message: {e}")
            return None