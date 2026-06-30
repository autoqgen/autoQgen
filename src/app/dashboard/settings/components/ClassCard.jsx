export default function ClassCard({ cls }) {
  return (
    <div className="bg-gray-50 border border-gray-100 hover:border-purple-200 p-5 rounded-2xl transition duration-300 flex flex-col justify-between gap-4 group">
      <div>
        <h3 className="font-bold text-gray-800 text-lg leading-snug">
          {cls.name}
        </h3>
        <div className="text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-100/60 rounded-md px-2 py-0.5 w-fit mt-2">
          {cls.code}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200/50 pt-3">
        <span className="text-xs text-gray-400 font-semibold">STUDENTS</span>
        <span className="text-sm font-bold text-gray-700">
          {cls.students} enrolled
        </span>
      </div>
    </div>
  );
}
