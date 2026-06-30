import { User, BookOpen } from "lucide-react";

export default function TabMenu({ activeTab, setActiveTab }) {
  return (
    <div className="bg-white border border-gray-100 p-2 rounded-2xl flex gap-2 shadow-sm w-fit">
      <button
        onClick={() => setActiveTab("account")}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
          activeTab === "account"
            ? "bg-purple-600 text-white shadow-md shadow-purple-200"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <User size={18} />
        Account
      </button>
      <button
        onClick={() => setActiveTab("class")}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
          activeTab === "class"
            ? "bg-purple-600 text-white shadow-md shadow-purple-200"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <BookOpen size={18} />
        Class
      </button>
    </div>
  );
}