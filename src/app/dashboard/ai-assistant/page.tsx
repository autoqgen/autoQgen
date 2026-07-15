import ChatWindow from "@/components/ai/ChatWindow";

export const metadata = {
  title: "AI Assistant — AutoQgen",
};

export default function AiAssistantPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-4">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-slate-900">AI Assistant</h1>
        <p className="text-sm text-slate-500">
          Search your Question Bank using natural language. Bangla or English.
        </p>
      </div>
      <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
        <ChatWindow />
      </div>
    </div>
  );
}
