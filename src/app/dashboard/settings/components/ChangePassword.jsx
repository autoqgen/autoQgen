import { Key } from "lucide-react";

export default function ChangePassword({
  isChangingPassword,
  setIsChangingPassword,
  passwordFields,
  setPasswordFields,
  handleSavePassword,
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-purple-600" />
          <h2 className="font-bold text-gray-800">Change Password</h2>
        </div>
        {!isChangingPassword && (
          <button
            onClick={() => setIsChangingPassword(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-purple-600 hover:border-purple-200 transition duration-200 cursor-pointer"
          >
            <Key size={14} />
            Change
          </button>
        )}
      </div>

      {!isChangingPassword ? (
        <p className="text-sm text-gray-500">
          Regularly change your password to ensure your account security.
        </p>
      ) : (
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm"
                value={passwordFields.currentPassword}
                onChange={(e) =>
                  setPasswordFields({
                    ...passwordFields,
                    currentPassword: e.target.value,
                  })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1.5">
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm"
                value={passwordFields.newPassword}
                onChange={(e) =>
                  setPasswordFields({
                    ...passwordFields,
                    newPassword: e.target.value,
                  })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-500 text-gray-800 text-sm"
                value={passwordFields.confirmPassword}
                onChange={(e) =>
                  setPasswordFields({
                    ...passwordFields,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(false);
                setPasswordFields({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-md shadow-purple-100 transition duration-200 cursor-pointer"
            >
              Save Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
