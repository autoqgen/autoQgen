import { User, Edit2, Copy, Check } from "lucide-react";

export default function PersonalInformation({
  userDetails,
  isEditingInfo,
  setIsEditingInfo,
  tempInfo,
  setTempInfo,
  handleSaveInfo,
  handleCopy,
  copiedField,
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <User size={18} className="text-purple-600" />
          <h2 className="font-bold text-gray-800">Personal Information</h2>
        </div>
        {!isEditingInfo ? (
          <button
            onClick={() => {
              setTempInfo({ ...userDetails });
              setIsEditingInfo(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-purple-600 hover:border-purple-200 transition duration-200 cursor-pointer"
          >
            <Edit2 size={14} />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditingInfo(false)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveInfo}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-md shadow-purple-100 transition duration-200 cursor-pointer"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {!isEditingInfo ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              NAME
            </label>
            <div className="font-semibold text-gray-800">
              {userDetails.name}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              EMAIL
            </label>
            <div className="font-semibold text-gray-800">
              {userDetails.email}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              PHONE NUMBER
            </label>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">
                {userDetails.phone}
              </span>
              <button
                onClick={() => handleCopy(userDetails.phone, "phone")}
                className="text-gray-400 hover:text-purple-600 p-1 rounded-md hover:bg-gray-50 transition cursor-pointer"
                title="Copy Phone Number"
              >
                {copiedField === "phone" ? (
                  <Check size={14} className="text-emerald-500" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              ROLE
            </label>
            <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-100">
              {userDetails.role}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">
              Name
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm font-medium"
              value={tempInfo.name}
              onChange={(e) =>
                setTempInfo({ ...tempInfo, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm font-medium"
              value={tempInfo.email}
              onChange={(e) =>
                setTempInfo({ ...tempInfo, email: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm font-medium"
              value={tempInfo.phone}
              onChange={(e) =>
                setTempInfo({ ...tempInfo, phone: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">
              Role
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm font-medium cursor-not-allowed"
              value={tempInfo.role}
              disabled
            />
          </div>
        </div>
      )}
    </div>
  );
}
