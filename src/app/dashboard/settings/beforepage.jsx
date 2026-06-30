"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  BookOpen,
  Key,
  Building2,
  Globe,
  Copy,
  Check,
  Shield,
  LogOut,
  Edit2,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("account");
  const [copiedField, setCopiedField] = useState("");

  // User details state (initialized with session or defaults)
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    phone: "01818096120",
    role: "SUPER-ADMIN",
    orgName: "",
    subdomain: "",
    uuid: "3b15ecc3-a8f6-497e-bf68-2721e230ca88",
  });

  // Sync state with session details once loaded
  useEffect(() => {
    const userName = session?.user?.name || "Mishkat";
    const userEmail = session?.user?.email || "mitmaxpro@gmail.com";
    const userRole = session?.user?.role || "SUPER-ADMIN";
    const normalizedSubdomain = userName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    setUserDetails((prev) => ({
      ...prev,
      name: userName,
      email: userEmail,
      role: userRole,
      orgName: `${userName}'s Organization`,
      subdomain: normalizedSubdomain || "mishkat",
    }));
  }, [session]);

  // Edit Personal Information state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempInfo, setTempInfo] = useState({ ...userDetails });

  // Change Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFields, setPasswordFields] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Static list of classes
  const classes = [
    { id: 1, name: "Class 10 - Mathematics", code: "MATH101", students: 35 },
    { id: 2, name: "Class 12 - Physics", code: "PHYS202", students: 28 },
    { id: 3, name: "Class 9 - Chemistry", code: "CHEM099", students: 42 },
  ];

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(""), 2000);
  };

  // Handler for saving personal info (Mock frontend logic)
  const handleSaveInfo = () => {
    setUserDetails((prev) => ({
      ...prev,
      name: tempInfo.name,
      email: tempInfo.email,
      phone: tempInfo.phone,
      orgName: `${tempInfo.name}'s Organization`,
      subdomain: tempInfo.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
    setIsEditingInfo(false);
  };

  // Handler for saving password (Mock frontend logic)
  const handleSavePassword = (e) => {
    e.preventDefault();
    // Simulate update API call here
    setIsChangingPassword(false);
    setPasswordFields({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs Menu */}
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

      {/* Active Tab View */}
      {activeTab === "account" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT & CENTER PANEL */}
          <div className="lg:col-span-2 space-y-6">
            {/* PROFILE SUMMARY */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-2 border-b border-gray-50 pb-4 mb-5">
                <User size={18} className="text-purple-600" />
                <h2 className="font-bold text-gray-800">Profile Summary</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 text-3xl font-extrabold shadow-sm">
                    {userDetails.name
                      ? userDetails.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h3 className="text-xl font-bold text-gray-800">
                    {userDetails.name}
                  </h3>
                  <p className="text-gray-500 font-medium text-sm">
                    {userDetails.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    Member since December 11, 2025
                  </p>
                </div>
              </div>
            </div>

            {/* PERSONAL INFORMATION */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-purple-600" />
                  <h2 className="font-bold text-gray-800">
                    Personal Information
                  </h2>
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

            {/* CHANGE PASSWORD */}
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
                  Regularly change your password to ensure your account
                  security.
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
          </div>

          {/* RIGHT SIDE PANEL */}
          <div className="space-y-6">
            {/* ORGANIZATION INFO */}
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

            {/* SECURITY LOGOUT */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-2 border-b border-gray-50 pb-4 mb-5">
                <Shield size={18} className="text-purple-600" />
                <h2 className="font-bold text-gray-800">Security</h2>
              </div>

              <div className="bg-[#FAF5FF] border border-purple-100/50 rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-800 text-sm">
                    Log Out From All Devices
                  </h3>
                  <p className="text-xs font-medium text-gray-500 leading-relaxed">
                    Log out from all other active sessions and devices for
                    enhanced security.
                  </p>
                </div>

                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-100 hover:shadow-lg transition duration-200 cursor-pointer"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CLASS VIEW */
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
              <div
                key={cls.id}
                className="bg-gray-50 border border-gray-100 hover:border-purple-200 p-5 rounded-2xl transition duration-300 flex flex-col justify-between gap-4 group"
              >
                <div>
                  <h3 className="font-bold text-gray-800 text-lg leading-snug">
                    {cls.name}
                  </h3>
                  <div className="text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-100/60 rounded-md px-2 py-0.5 w-fit mt-2">
                    {cls.code}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200/50 pt-3">
                  <span className="text-xs text-gray-400 font-semibold">
                    STUDENTS
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {cls.students} enrolled
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
