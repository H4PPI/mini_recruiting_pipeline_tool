const MOCK_USER = {
  name: "Siriporn Kaewkla",
  role: "HR Manager",
  department: "Human Resources",
  avatarInitials: "SK",
};

export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-black/10 px-6 flex items-center justify-end shrink-0">
      {/* User Profile */}
      <div className="flex items-center gap-3">
        {/* Info */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-black leading-tight">
            {MOCK_USER.name}
          </p>
          <p className="text-xs text-black/50 leading-tight">
            {MOCK_USER.role} · {MOCK_USER.department}
          </p>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-mainYellow flex items-center justify-center shrink-0">
          <span className="text-black font-bold text-sm">
            {MOCK_USER.avatarInitials}
          </span>
        </div>
      </div>
    </header>
  );
}
