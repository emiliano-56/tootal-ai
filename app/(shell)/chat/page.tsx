'use client' 
 
import { useState, useRef, useEffect } from 'react' 
import { useRouter } from 'next/navigation' 
import { ArrowLeft, Send, Copy, Check, MessageCircle, History, Trash2, Edit2 } from 'lucide-react' 
import { Button } from '@/components/ui/button' 
import { Footer } from '@/components/footer' 
import { supabase } from '@/lib/db'
import { usePromptPrefill } from '@/lib/dfy/use-prefill'
 
interface Message { 
 id: string 
 type: 'user' | 'ai' 
 content: string 
 timestamp: Date 
} 

interface Chat {
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
}
 
export default function ChatPage() { 
 const router = useRouter() 
 const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat') 
 const [chatMessages, setChatMessages] = useState<Message[]>([]) 
 const [input, setInput] = useState('') 

 // Arriving from a DFY pack with a tutor prompt.
 usePromptPrefill(setInput)
 const [loading, setLoading] = useState(false) 
 const [copiedId, setCopiedId] = useState<string | null>(null)
 const [savedChats, setSavedChats] = useState<Chat[]>([])
 const [currentChatId, setCurrentChatId] = useState<string | null>(null)
 const [editingId, setEditingId] = useState<string | null>(null)
 const [editingTitle, setEditingTitle] = useState('')
 const [loadingHistory, setLoadingHistory] = useState(false)
 const messagesEndRef = useRef<HTMLDivElement | null>(null)
 
 const scrollToBottom = () => { 
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) 
 } 
 
 useEffect(() => { 
 scrollToBottom() 
 }, [chatMessages]) 

 // Load chats from Supabase when History tab is opened
 useEffect(() => {
   if (activeTab === 'history') {
     loadChatsFromSupabase()
   }
 }, [activeTab])

 const loadChatsFromSupabase = async () => {
   setLoadingHistory(true)
   try {
     const { data: { user } } = await supabase.auth.getUser()
     if (!user) {
       alert('Please log in to view chat history')
       return
     }

     const { data, error } = await supabase
       .from('chats')
       .select('*')
       .eq('user_id', user.id)
       .order('created_at', { ascending: false })

     if (error) throw error
     setSavedChats(data || [])
   } catch (error) {
     console.error('Error loading chats:', error)
     alert('Failed to load chat history')
   } finally {
     setLoadingHistory(false)
   }
 }

 const saveChatToSupabase = async (messages: Message[], title?: string) => {
   try {
     const { data: { user } } = await supabase.auth.getUser()
     if (!user) {
       alert('Please log in to save chats')
       return
     }

     const chatTitle = title || `Chat - ${new Date().toLocaleString()}`

     if (currentChatId) {
       // Update existing chat
       const { error } = await supabase
         .from('chats')
         .update({
           messages: messages,
           updated_at: new Date().toISOString(),
         })
         .eq('id', currentChatId)

       if (error) throw error
     } else {
       // Create new chat
       const { data, error } = await supabase
         .from('chats')
         .insert({
           user_id: user.id,
           title: chatTitle,
           messages: messages,
         })
         .select()

       if (error) throw error
       if (data && data.length > 0) {
         setCurrentChatId(data[0].id)
       }
     }
   } catch (error) {
     console.error('Error saving chat:', error)
     alert('Failed to save chat')
   }
 }

 const loadChatHistory = (chat: Chat) => {
   const messagesWithDates = chat.messages.map(msg => ({
     ...msg,
     timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp
   }))
   setChatMessages(messagesWithDates)
   setCurrentChatId(chat.id)
   setActiveTab('chat')
 }

 const deleteChatHistory = async (chatId: string) => {
   if (!confirm('Are you sure you want to delete this chat?')) return

   try {
     const { error } = await supabase
       .from('chats')
       .delete()
       .eq('id', chatId)

     if (error) throw error
     setSavedChats(savedChats.filter(c => c.id !== chatId))
   } catch (error) {
     console.error('Error deleting chat:', error)
     alert('Failed to delete chat')
   }
 }

 const updateChatTitle = async (chatId: string, newTitle: string) => {
   try {
     const { error } = await supabase
       .from('chats')
       .update({ title: newTitle })
       .eq('id', chatId)

     if (error) throw error
     setSavedChats(savedChats.map(c => 
       c.id === chatId ? { ...c, title: newTitle } : c
     ))
     setEditingId(null)
     setEditingTitle('')
   } catch (error) {
     console.error('Error updating chat title:', error)
     alert('Failed to update chat title')
   }
 }
 
 const handleCopyText = (text: string, id: string) => { 
 navigator.clipboard.writeText(text)
 setCopiedId(id)
 setTimeout(() => setCopiedId(null), 2000)
 } 
 
 const handleChatMessage = async () => { 
 if (!input.trim()) { 
 alert('Please enter a message') 
 return 
 } 
 
 const userMessage: Message = { 
 id: Date.now().toString(), 
 type: 'user', 
 content: input, 
 timestamp: new Date(), 
 } 
 
 setChatMessages(prev => [...prev, userMessage]) 
 setInput('') 
 setLoading(true) 
 
 try { 
 const response = await fetch('/api/chat', { 
 method: 'POST', 
 headers: { 'Content-Type': 'application/json' }, 
 body: JSON.stringify({ 
 message: input, 
 }), 
 }) 
 
 const data = await response.json() 
 
 if (response.ok) { 
 const aiMessage: Message = { 
 id: (Date.now() + 1).toString(), 
 type: 'ai', 
 content: data.response, 
 timestamp: new Date(), 
 } 
 setChatMessages(prev => [...prev, aiMessage])
 } else { 
 const errorMessage: Message = { 
 id: (Date.now() + 1).toString(), 
 type: 'ai', 
 content: `Error: ${data.error || 'Failed to get response'}`, 
 timestamp: new Date(), 
 } 
 setChatMessages(prev => [...prev, errorMessage]) 
 } 
 } catch (error) { 
 const errorMessage: Message = { 
 id: (Date.now() + 1).toString(), 
 type: 'ai', 
 content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`, 
 timestamp: new Date(), 
 } 
 setChatMessages(prev => [...prev, errorMessage]) 
 } finally { 
 setLoading(false) 
 } 
 } 

 // Auto-save chat when messages change
 useEffect(() => {
   if (chatMessages.length > 0 && activeTab === 'chat') {
     const saveTimer = setTimeout(() => {
       saveChatToSupabase(chatMessages)
     }, 2000)
     return () => clearTimeout(saveTimer)
   }
 }, [chatMessages, activeTab])
 
return (
 <div className="flex flex-col h-screen bg-gray-50">

 {/* Header */}
 <div className="border-b border-gray-200 px-4 py-4 bg-white">
  <button
 onClick={() => router.push('/dashboard')}
 className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-black font-medium text-sm"
 >
 <ArrowLeft size={18} />
 Back to Home
 </button>
 <div className="flex items-center gap-3 mt-4">
   <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
     <MessageCircle className="w-4.5 h-4.5 text-white" />
   </div>
   <h1 className="text-xl font-bold text-black">ComicTale Prompt Chat</h1>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 border-b border-gray-200 bg-white px-4">
  <button
 onClick={() => setActiveTab('chat')}
 className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
 activeTab === 'chat'
 ? 'border-blue-600 text-blue-600'
 : 'border-transparent text-gray-500 hover:text-black'
 }`}
 >
 <MessageCircle size={18} />
 Chat
 </button>
  <button
 onClick={() => setActiveTab('history')}
 className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
 activeTab === 'history'
 ? 'border-blue-600 text-blue-600'
 : 'border-transparent text-gray-500 hover:text-black'
 }`}
 >
 <History size={18} />
 History
 </button>
 </div>

 {/* Chat Mode */}
 {activeTab === 'chat' && (
 <div className="flex-1 flex flex-col overflow-hidden">
 {/* Messages Area */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {chatMessages.length === 0 ? (
 <div className="flex items-center justify-center h-full text-gray-400 text-sm">
 Start a conversation...
 </div>
 ) : (
 chatMessages.map(msg => (
 <div
 key={msg.id}
 className={`flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
 >
 <div
 className={`max-w-xs lg:max-w-md rounded-2xl p-4 shadow-sm ${
 msg.type === 'user'
 ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
 : 'bg-white border border-gray-100 text-black'
 }`}
 >
 <p className="text-sm">{msg.content}</p>

 <div className="flex items-center justify-between gap-2 mt-2 text-xs opacity-70">
 <span>
 {msg.timestamp.toLocaleTimeString([], {
 hour: '2-digit',
 minute: '2-digit',
 })}
 </span>
  <button
 onClick={() => handleCopyText(msg.content, msg.id)}
 className="opacity-50 hover:opacity-100 transition-opacity"
 >
 {copiedId === msg.id ? (
 <Check size={14} />
 ) : (
 <Copy size={14} />
 )}
 </button>
 </div>
 </div>
 </div>
 ))
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Input Area */}
 <div className="border-t border-gray-200 p-4 bg-white">
 <div className="flex gap-2">
  <input
 type="text"
 placeholder="Type a message..."
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyPress={(e) => e.key === 'Enter' && handleChatMessage()}
 disabled={loading}
 className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 disabled:opacity-50 transition-colors"
 />
  <button
 onClick={handleChatMessage}
 disabled={loading}
 className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 flex items-center gap-2 font-semibold shadow-md shadow-blue-500/25 transition-all"
 >
 <Send size={18} />
 </button>
 </div>
 </div>
 </div>
 )}

 {/* History Tab */}
 {activeTab === 'history' && (
 <div className="flex-1 overflow-y-auto p-4">
 {loadingHistory ? (
   <div className="flex items-center justify-center h-full text-gray-400 text-sm">
     Loading chats...
   </div>
 ) : savedChats.length === 0 ? (
 <div className="flex items-center justify-center h-full text-gray-400 text-sm">
 No history yet. Start chatting!
 </div>
 ) : (
 <div className="space-y-3">
 {savedChats.map((chat) => (
 <div
 key={chat.id}
 className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 cursor-pointer" onClick={() => loadChatHistory(chat)}>
 {editingId === chat.id ? (
   <input
     type="text"
     value={editingTitle}
     onChange={(e) => setEditingTitle(e.target.value)}
     onKeyPress={(e) => {
       if (e.key === 'Enter') {
         updateChatTitle(chat.id, editingTitle)
       }
     }}
     className="w-full px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-black text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 mb-2"
     autoFocus
   />
 ) : (
   <h3 className="font-semibold text-black text-sm">{chat.title}</h3>
 )}
 <p className="text-xs text-gray-400 mt-1">
 {new Date(chat.created_at).toLocaleString()}
 </p>
 <p className="text-sm text-gray-500 mt-2 truncate">
 {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
 </p>
 </div>

 <div className="flex gap-2 shrink-0">
 {editingId === chat.id ? (
   <>
     <button
       onClick={() => updateChatTitle(chat.id, editingTitle)}
       className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold"
     >
       Save
     </button>
     <button
       onClick={() => setEditingId(null)}
       className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold hover:bg-gray-200 text-black"
     >
       Cancel
     </button>
   </>
 ) : (
   <>
     <button
       onClick={() => {
         setEditingId(chat.id)
         setEditingTitle(chat.title)
       }}
       className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"
       title="Edit chat title"
     >
       <Edit2 size={16} />
     </button>
     <button
       onClick={() => deleteChatHistory(chat.id)}
       className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
       title="Delete chat"
     >
       <Trash2 size={16} />
     </button>
   </>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Footer */}
 <Footer />
 </div>
 )
}
