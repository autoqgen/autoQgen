"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import TabMenu from "./components/TabMenu";
import ProfileSummary from "./components/ProfileSummary";
import PersonalInformation from "./components/PersonalInformation";
import ChangePassword from "./components/ChangePassword";
import OrganizationInfo from "./components/OrganizationInfo";
import SecurityLogout from "./components/SecurityLogout";
import ClassDirectory from "./components/ClassDirectory";

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
      <TabMenu activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Active Tab View */}
      {activeTab === "account" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT & CENTER PANEL */}
          <div className="lg:col-span-2 space-y-6">
            <ProfileSummary userDetails={userDetails} />
            <PersonalInformation
              userDetails={userDetails}
              isEditingInfo={isEditingInfo}
              setIsEditingInfo={setIsEditingInfo}
              tempInfo={tempInfo}
              setTempInfo={setTempInfo}
              handleSaveInfo={handleSaveInfo}
              handleCopy={handleCopy}
              copiedField={copiedField}
            />
            <ChangePassword
              isChangingPassword={isChangingPassword}
              setIsChangingPassword={setIsChangingPassword}
              passwordFields={passwordFields}
              setPasswordFields={setPasswordFields}
              handleSavePassword={handleSavePassword}
            />
          </div>

          {/* RIGHT SIDE PANEL */}
          <div className="space-y-6">
            <OrganizationInfo
              userDetails={userDetails}
              handleCopy={handleCopy}
              copiedField={copiedField}
            />
            <SecurityLogout />
          </div>
        </div>
      ) : (
        /* CLASS VIEW */
        <ClassDirectory classes={classes} />
      )}
    </div>
  );
}
