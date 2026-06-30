import { Building2, Globe, Copy, Check } from "lucide-react";

export default function OrganizationInfo({
  userDetails,
  handleCopy,
  copiedField,
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-gray-50 pb-4 mb-5">
        <Building2 size={18} className="text-purple-600" />
        <h2 className="font-bold text-gray-800">Organization Info</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">
            NAME
          </label>
          <div className="font-bold text-gray-800 text-sm sm:text-base truncate">
            {userDetails.orgName}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">
            SUBDOMAIN
          </label>
          <div className="flex items-center gap-1.5 text-gray-800 font-semibold text-sm">
            <Globe size={14} className="text-purple-500" />
            <span>{userDetails.subdomain}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">
            UUID
          </label>
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-2.5 rounded-xl gap-2 max-w-full">
            <span className="text-xs font-mono font-medium text-gray-600 truncate">
              {userDetails.uuid}
            </span>
            <button
              onClick={() => handleCopy(userDetails.uuid, "uuid")}
              className="text-gray-400 hover:text-purple-600 p-1.5 bg-white border border-gray-100 rounded-lg hover:shadow-xs transition flex-shrink-0 cursor-pointer"
              title="Copy UUID"
            >
              {copiedField === "uuid" ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
