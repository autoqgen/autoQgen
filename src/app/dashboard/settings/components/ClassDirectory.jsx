import ClassCard from "./ClassCard";

export default function ClassDirectory({ classes }) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-50 pb-5">
        <div>
          <h2 className="font-extrabold text-gray-800 text-xl">
            Class Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage class sections, view codes, and track total students.
          </p>
        </div>
      </div>

      {/* Grid of Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => (
          <ClassCard key={cls.id} cls={cls} />
        ))}
      </div>
    </div>
  );
}
