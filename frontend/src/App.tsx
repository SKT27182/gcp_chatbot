import { QueryClientProvider } from "@tanstack/react-query"
import { ChatPage } from "@/features/chat/ChatPage"
import { queryClient } from "@/lib/queryClient"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="h-full">
        <ChatPage />
      </main>
    </QueryClientProvider>
  )
}
