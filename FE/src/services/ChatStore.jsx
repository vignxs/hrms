import { create } from 'zustand';
import axios from 'axios';

console.log('🔄 [ChatStore] Initializing...');

export const useChatStore = create((set, get) => ({
  users: [],
  chatRooms: [],
  loading: false,
  error: null,

  /**
   * Fetches the list of chat rooms for the given user ID.
   * Returns the list of chat rooms or an empty array if no rooms are found.
   * If the request fails, throws an error and sets the "error" state to the error message.
   * @param {number} userId The user ID to fetch chat rooms for.
   * @returns {Promise<ChatRoom[]>} A promise that resolves to the list of chat rooms.
   */
  fetchChatRooms: async (userId) => {
    console.log('🔍 [ChatStore] fetchChatRooms called with userId:', userId);
    if (!userId) {
      console.error('❌ [ChatStore] No userId provided to fetchChatRooms');
      return [];
    }
    
    set({ loading: true, error: null });
    
    try {
      const token = localStorage.getItem('access_token');
      console.log('🔑 [ChatStore] Using token:', token ? '[TOKEN_PRESENT]' : 'NO_TOKEN');
      
      const response = await axios.get(`/api/chat-rooms/${userId}/`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: (status) => status < 500
      });
      
      console.log(`✅ [ChatStore] Fetched ${response.data?.length || 0} chat rooms`);
      set({ chatRooms: Array.isArray(response.data) ? response.data : [] });
      return response.data || [];
    } catch (error) {
      console.error('❌ [ChatStore] Error in fetchChatRooms:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchUsers: async () => {
    console.log('🔍 [ChatStore] fetchUsers called');
    set({ loading: true, error: null });
    
    try {
      // Check cache first
      const cached = localStorage.getItem('cachedUsers');
      if (cached) {
        console.log('📦 [ChatStore] Using cached users');
        const users = JSON.parse(cached);
        set({ users });
        return users;
      }
      
      const token = localStorage.getItem('access_token');
      console.log('🔑 [ChatStore] Fetching users with token:', token ? '[TOKEN_PRESENT]' : 'NO_TOKEN');
      
      const response = await axios.get('/api/users/', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: (status) => status < 500
      });
      
      console.log(`✅ [ChatStore] Fetched ${response.data?.length || 0} users`);
      
      if (response.data?.length) {
        const users = Array.isArray(response.data) ? response.data : [];
        localStorage.setItem('cachedUsers', JSON.stringify(users));
        set({ users });
        return users;
      }
      
      return [];
    } catch (error) {
      console.error('❌ [ChatStore] Error in fetchUsers:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));

// Export standalone functions for use outside of React components
export const fetchChatRooms = (userId) => {
  console.log('📡 [ChatStore] Standalone fetchChatRooms called with userId:', userId);
  return useChatStore.getState().fetchChatRooms(userId);
};

export const fetchUsers = () => {
  console.log('📡 [ChatStore] Standalone fetchUsers called');
  return useChatStore.getState().fetchUsers();
};
