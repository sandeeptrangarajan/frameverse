import { useState, useMemo } from "react";

const YEAR_SECTIONS = [
  {
    key: "first_year",
    label: "First Year",
    short: "1st Year",
    number: "01",
    color: "#3b82f6",
    colorGlow: "rgba(59, 130, 246, 0.25)",
    border: "rgba(59, 130, 246, 0.4)",
    badgeBg: "rgba(59, 130, 246, 0.12)",
  },
  {
    key: "second_year",
    label: "Second Year",
    short: "2nd Year",
    number: "02",
    color: "#10b981",
    colorGlow: "rgba(16, 185, 129, 0.25)",
    border: "rgba(16, 185, 129, 0.4)",
    badgeBg: "rgba(16, 185, 129, 0.12)",
  },
  {
    key: "third_year",
    label: "Third Year",
    short: "3rd Year",
    number: "03",
    color: "#f59e0b",
    colorGlow: "rgba(245, 158, 11, 0.25)",
    border: "rgba(245, 158, 11, 0.4)",
    badgeBg: "rgba(245, 158, 11, 0.12)",
  },
  {
    key: "fourth_year",
    label: "Fourth Year",
    short: "4th Year",
    number: "04",
    color: "#a855f7",
    colorGlow: "rgba(168, 85, 247, 0.25)",
    border: "rgba(168, 85, 247, 0.4)",
    badgeBg: "rgba(168, 85, 247, 0.12)",
  },
];

function parseTeamMembers(value) {
  let members = value;
  if (typeof members === "string") {
    try {
      members = JSON.parse(members);
    } catch {
      return [];
    }
  }
  return Array.isArray(members)
    ? members.filter(
        (m) => m && typeof m === "object" && !Array.isArray(m)
      )
    : [];
}

export default function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [registrations, setRegistrations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [laptopFilter, setLaptopFilter] = useState("all");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchRegistrations() {
    setRefreshing(true);
    try {
      const result = await fetch("/api/admin/registrations", {
        credentials: "same-origin",
      });
      const records = await result.json();
      if (!result.ok) {
        setMessage(records.message || "Could not load registrations.");
        return;
      }
      setRegistrations(records.registrations);
      showToast("Registrations refreshed!");
    } catch {
      setMessage("Could not connect to backend.");
    } finally {
      setRefreshing(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Invalid credentials.");
        return;
      }

      await fetchRegistrations();
      setPassword("");
    } catch {
      setMessage("Cannot connect to the backend server.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // ignore
    }
    setRegistrations(null);
    setMessage("Successfully logged out.");
    showToast("Logged out");
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label}: ${text}`);
  }

  // Export CSV function
  function exportCSV() {
    if (!registrations) return;

    const headers = [
      "Academic Year",
      "Registration ID",
      "Team Leader",
      "Mobile",
      "Laptop Available",
      "Member 1 Name",
      "Member 1 Reg No",
      "Member 1 Sec",
      "Member 2 Name",
      "Member 2 Reg No",
      "Member 2 Sec",
      "Member 3 Name",
      "Member 3 Reg No",
      "Member 3 Sec",
      "Registered At",
    ];

    const rows = [];

    YEAR_SECTIONS.forEach((year) => {
      const list = registrations[year.key] || [];
      list.forEach((reg) => {
        const members = parseTeamMembers(reg.team_members);
        const m1 = members[0] || {};
        const m2 = members[1] || {};
        const m3 = members[2] || {};

        rows.push([
          `"${year.label}"`,
          `"${reg.registration_id}"`,
          `"${reg.team_lead_name}"`,
          `"${reg.mobile}"`,
          `"${reg.laptop_availability}"`,
          `"${m1.name || ""}"`,
          `"${m1.registerNumber || ""}"`,
          `"${m1.section || ""}"`,
          `"${m2.name || ""}"`,
          `"${m2.registerNumber || ""}"`,
          `"${m2.section || ""}"`,
          `"${m3.name || ""}"`,
          `"${m3.registerNumber || ""}"`,
          `"${m3.section || ""}"`,
          `"${reg.created_at || ""}"`,
        ]);
      });
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `frameverse_2026_registrations_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded registrations CSV!");
  }

  // Calculate statistics
  const stats = useMemo(() => {
    if (!registrations) return { totalTeams: 0, totalStudents: 0, withLaptop: 0, yearCounts: {} };

    let totalTeams = 0;
    let totalStudents = 0;
    let withLaptop = 0;
    const yearCounts = {};

    YEAR_SECTIONS.forEach((year) => {
      const list = Array.isArray(registrations[year.key]) ? registrations[year.key] : [];
      yearCounts[year.key] = list.length;
      totalTeams += list.length;

      list.forEach((reg) => {
        if (reg.laptop_availability === "Yes") withLaptop++;
        const members = parseTeamMembers(reg.team_members);
        totalStudents += members.length;
      });
    });

    return { totalTeams, totalStudents, withLaptop, yearCounts };
  }, [registrations]);

  // Filtered registrations
  const filteredData = useMemo(() => {
    if (!registrations) return {};

    const q = searchQuery.trim().toLowerCase();
    const result = {};

    YEAR_SECTIONS.forEach((year) => {
      if (selectedYear !== "all" && selectedYear !== year.key) {
        result[year.key] = [];
        return;
      }

      let list = Array.isArray(registrations[year.key]) ? registrations[year.key] : [];

      if (laptopFilter !== "all") {
        list = list.filter((item) =>
          laptopFilter === "yes"
            ? item.laptop_availability === "Yes"
            : item.laptop_availability === "No"
        );
      }

      if (q) {
        list = list.filter((item) => {
          const matchLead = (item.team_lead_name || "").toLowerCase().includes(q);
          const matchId = (item.registration_id || "").toLowerCase().includes(q);
          const matchMobile = (item.mobile || "").includes(q);
          const members = parseTeamMembers(item.team_members);
          const matchMember = members.some(
            (m) =>
              (m.name || "").toLowerCase().includes(q) ||
              (m.registerNumber || "").toLowerCase().includes(q) ||
              (m.section || "").toLowerCase().includes(q)
          );
          return matchLead || matchId || matchMobile || matchMember;
        });
      }

      result[year.key] = list;
    });

    return result;
  }, [registrations, searchQuery, selectedYear, laptopFilter]);

  const totalFilteredCount = useMemo(() => {
    return Object.values(filteredData).reduce((sum, list) => sum + list.length, 0);
  }, [filteredData]);

  return (
    <div className="admin-root">
      {/* Toast popup */}
      {toast && <div className="admin-toast">{toast}</div>}

      <style>{`
        .admin-root {
          min-height: 100vh;
          width: 100%;
          background: #09090b;
          color: #f4f4f5;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          position: relative;
          overflow-x: hidden;
          background-image: 
            radial-gradient(ellipse at 80% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 10% 100%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
            linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 48px 48px, 48px 48px;
        }

        .admin-shell {
          max-width: 1380px;
          margin: 0 auto;
          padding: 24px 20px 80px;
        }

        /* Top Bar */
        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(18, 20, 29, 0.75);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          margin-bottom: 28px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          gap: 16px;
          flex-wrap: wrap;
        }

        .brand-badge-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 20px;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .brand-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.35);
          padding: 3px 10px;
          border-radius: 20px;
        }

        .db-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 5px 12px;
          border-radius: 20px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-ghost {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.2s ease;
        }

        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .btn-action-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: 0;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 18px;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
          transition: all 0.2s ease;
        }

        .btn-action-primary:hover {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 15px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.22);
          border-color: #ef4444;
        }

        /* Login Card */
        .login-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(80vh - 100px);
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background: rgba(18, 20, 30, 0.85);
          backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 38px 32px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
          text-align: left;
          position: relative;
          overflow: hidden;
        }

        .login-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6, #a855f7, #ec4899);
        }

        .login-icon-circle {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 20px;
          color: #818cf8;
        }

        .login-card h2 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #ffffff;
        }

        .login-card p {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0 0 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #d4d4d8;
          margin-bottom: 8px;
        }

        .input-box-wrap {
          position: relative;
        }

        .form-input {
          width: 100%;
          background: rgba(9, 10, 15, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 15px;
          color: #fff;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.25);
          background: rgba(14, 16, 24, 0.9);
        }

        .password-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: 0;
          color: #71717a;
          cursor: pointer;
          font-size: 14px;
          padding: 6px;
        }

        .password-toggle-btn:hover {
          color: #e4e4e7;
        }

        .btn-login-submit {
          width: 100%;
          padding: 14px;
          margin-top: 10px;
          background: linear-gradient(135deg, #6366f1 0%, #9333ea 100%);
          color: white;
          border: 0;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btn-login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.55);
        }

        .btn-login-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-hint-badge {
          margin-top: 22px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-size: 12px;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .login-hint-badge code {
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 6px;
          color: #c4b5fd;
          font-family: 'JetBrains Mono', monospace;
        }

        .login-error-alert {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 18px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: rgba(18, 20, 30, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          padding: 22px 24px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .stat-title {
          font-size: 13px;
          font-weight: 600;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .stat-value {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 34px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 8px;
        }

        .stat-desc {
          font-size: 12px;
          color: #71717a;
          margin: 0;
        }

        /* Controls Section */
        .dashboard-controls {
          background: rgba(18, 20, 30, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .controls-search-row {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-input-wrap {
          flex: 1;
          min-width: 260px;
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #71717a;
          font-size: 15px;
        }

        .search-input {
          width: 100%;
          background: rgba(9, 10, 15, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 11px 16px 11px 40px;
          color: #fff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .filter-select {
          background: rgba(9, 10, 15, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 11px 16px;
          color: #e4e4e7;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          min-width: 150px;
        }

        .view-switch {
          display: flex;
          background: rgba(9, 10, 15, 0.8);
          padding: 4px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .view-switch-btn {
          background: transparent;
          border: 0;
          color: #a1a1aa;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-switch-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        /* Year Filter Tabs */
        .year-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .year-tab-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #a1a1aa;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .year-tab-pill:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #e4e4e7;
        }

        .year-tab-pill.active {
          background: var(--pill-color, #6366f1);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 4px 14px var(--pill-glow, rgba(99, 102, 241, 0.4));
        }

        .pill-count {
          font-size: 11px;
          padding: 2px 7px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          font-weight: 700;
        }

        /* Year Section Container */
        .year-group {
          margin-bottom: 36px;
        }

        .year-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: rgba(18, 20, 30, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid var(--year-border);
          border-left: 5px solid var(--year-color);
          border-radius: 16px;
          margin-bottom: 16px;
          gap: 12px;
        }

        .year-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .year-badge-num {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--year-color);
          background: var(--year-bg);
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--year-border);
        }

        .year-header-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: #ffffff;
        }

        .year-header-sub {
          font-size: 13px;
          color: #71717a;
          margin: 0;
        }

        .year-counter-badge {
          background: var(--year-bg);
          color: var(--year-color);
          border: 1px solid var(--year-border);
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
        }

        /* Cards Grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 18px;
        }

        .reg-card {
          background: rgba(18, 20, 30, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          position: relative;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .reg-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6);
        }

        .reg-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .reg-id-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 700;
          color: #67e8f9;
          background: rgba(6, 182, 212, 0.12);
          border: 1px solid rgba(6, 182, 212, 0.35);
          padding: 4px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s;
        }

        .reg-id-badge:hover {
          background: rgba(6, 182, 212, 0.25);
        }

        .laptop-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 10px;
          border-radius: 20px;
        }

        .laptop-badge.yes {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .laptop-badge.no {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .leader-banner {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }

        .leader-meta-title {
          font-size: 11px;
          font-weight: 700;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .leader-name {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 6px;
        }

        .leader-phone-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #93c5fd;
          font-family: 'JetBrains Mono', monospace;
        }

        .copy-icon-btn {
          background: transparent;
          border: 0;
          color: #71717a;
          cursor: pointer;
          font-size: 13px;
          padding: 2px 4px;
          transition: color 0.2s;
        }

        .copy-icon-btn:hover {
          color: #fff;
        }

        .roster-title {
          font-size: 12px;
          font-weight: 700;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 10px;
        }

        .roster-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .roster-member {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }

        .member-main-name {
          font-weight: 600;
          color: #f4f4f5;
        }

        .member-pills {
          display: flex;
          gap: 6px;
        }

        .reg-num-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #e4e4e7;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 7px;
          border-radius: 6px;
        }

        .section-tag {
          font-size: 11px;
          font-weight: 700;
          color: #c084fc;
          background: rgba(168, 85, 247, 0.12);
          border: 1px solid rgba(168, 85, 247, 0.25);
          padding: 2px 7px;
          border-radius: 6px;
        }

        .card-footer {
          margin-top: 18px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #71717a;
        }

        /* Table View */
        .table-wrap {
          background: rgba(18, 20, 30, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          overflow-x: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          margin-bottom: 28px;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
          min-width: 800px;
        }

        .admin-table th {
          background: rgba(255, 255, 255, 0.04);
          padding: 14px 18px;
          font-weight: 700;
          color: #a1a1aa;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .admin-table td {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
        }

        .admin-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 50px 20px;
          background: rgba(18, 20, 30, 0.5);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          color: #a1a1aa;
        }

        .empty-state-icon {
          font-size: 38px;
          margin-bottom: 14px;
        }

        .empty-state h3 {
          font-family: 'Space Grotesk', sans-serif;
          color: #fff;
          margin: 0 0 8px;
          font-size: 18px;
        }

        /* Toast */
        .admin-toast {
          position: fixed;
          bottom: 28px;
          right: 28px;
          background: #18181b;
          color: #fafafa;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 12px 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          font-size: 13px;
          font-weight: 600;
          z-index: 9999;
          animation: slideUp 0.25s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .admin-topbar {
            flex-direction: column;
            align-items: flex-start;
          }
          .topbar-actions {
            width: 100%;
            justify-content: space-between;
          }
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="admin-shell">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="brand-badge-group">
            <h1 className="brand-title">FRAMEVERSE 2026</h1>
            <span className="brand-tag">Admin Console</span>
            <span className="db-status-pill">
              <span className="status-dot"></span>
              Live DB Online
            </span>
          </div>

          <div className="topbar-actions">
            <a href="/" className="btn-ghost" title="Back to public registration page">
              ← Event Page
            </a>

            {registrations && (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={fetchRegistrations}
                  disabled={refreshing}
                  title="Reload registrations"
                >
                  <span style={{ display: "inline-block", transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.4s" }}>
                    🔄
                  </span>
                  {refreshing ? "Updating..." : "Refresh"}
                </button>

                <button
                  type="button"
                  className="btn-action-primary"
                  onClick={exportCSV}
                  title="Download all registrations to CSV Excel format"
                >
                  📥 Export CSV
                </button>

                <button
                  type="button"
                  className="btn-danger"
                  onClick={logout}
                  title="End admin session"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </header>

        {/* Login State */}
        {!registrations ? (
          <div className="login-wrap">
            <div className="login-card">
              <div className="login-icon-circle">🔐</div>
              <h2>Command Access</h2>
              <p>Sign in to manage and export event team registrations.</p>

              <form onSubmit={login}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-user">
                    Admin Username
                  </label>
                  <input
                    id="admin-user"
                    className="form-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-pass">
                    Admin Password
                  </label>
                  <div className="input-box-wrap">
                    <input
                      id="admin-pass"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-login-submit" disabled={loading}>
                  {loading ? "Authenticating..." : "Sign In to Console →"}
                </button>
              </form>

              {message && <div className="login-error-alert">{message}</div>}

              <div className="login-hint-badge">
                <span>Default Local User:</span>
                <code>admin / admin123</code>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard State */
          <>
            {/* KPI Statistics */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Total Teams</span>
                  <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                    👥
                  </div>
                </div>
                <div className="stat-value">{stats.totalTeams}</div>
                <p className="stat-desc">Confirmed team registrations</p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Total Students</span>
                  <div className="stat-icon" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
                    🎓
                  </div>
                </div>
                <div className="stat-value">{stats.totalStudents}</div>
                <p className="stat-desc">Participants across all years</p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Laptops Ready</span>
                  <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    💻
                  </div>
                </div>
                <div className="stat-value">{stats.withLaptop}</div>
                <p className="stat-desc">
                  {stats.totalTeams > 0
                    ? `${Math.round((stats.withLaptop / stats.totalTeams) * 100)}% of teams have laptops`
                    : "No teams registered yet"}
                </p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Academic Years</span>
                  <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                    🏆
                  </div>
                </div>
                <div className="stat-value">4</div>
                <p className="stat-desc">1st, 2nd, 3rd, and 4th Years</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="dashboard-controls">
              <div className="controls-search-row">
                <div className="search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by ID (FV1), Lead Name, Mobile, Student Reg No, or Section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="filter-select"
                  value={laptopFilter}
                  onChange={(e) => setLaptopFilter(e.target.value)}
                  aria-label="Filter by laptop availability"
                >
                  <option value="all">Laptop: All Teams</option>
                  <option value="yes">💻 Laptop: Available</option>
                  <option value="no">⚠️ Laptop: Not Available</option>
                </select>

                <div className="view-switch">
                  <button
                    type="button"
                    className={`view-switch-btn ${viewMode === "cards" ? "active" : ""}`}
                    onClick={() => setViewMode("cards")}
                  >
                    📇 Cards
                  </button>
                  <button
                    type="button"
                    className={`view-switch-btn ${viewMode === "table" ? "active" : ""}`}
                    onClick={() => setViewMode("table")}
                  >
                    📊 Table
                  </button>
                </div>
              </div>

              {/* Year Filter Tabs */}
              <div className="year-tabs">
                <button
                  type="button"
                  className={`year-tab-pill ${selectedYear === "all" ? "active" : ""}`}
                  onClick={() => setSelectedYear("all")}
                >
                  <span>All Academic Years</span>
                  <span className="pill-count">{stats.totalTeams}</span>
                </button>

                {YEAR_SECTIONS.map((year) => {
                  const count = stats.yearCounts[year.key] || 0;
                  return (
                    <button
                      key={year.key}
                      type="button"
                      className={`year-tab-pill ${selectedYear === year.key ? "active" : ""}`}
                      style={{
                        "--pill-color": year.color,
                        "--pill-glow": year.colorGlow,
                      }}
                      onClick={() => setSelectedYear(year.key)}
                    >
                      <span>{year.label}</span>
                      <span className="pill-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If empty search results */}
            {totalFilteredCount === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <h3>No Registrations Match Filter</h3>
                <p>
                  Try clearing your search query or switching the category filter.
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedYear("all");
                    setLaptopFilter("all");
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            )}

            {/* Table View */}
            {viewMode === "table" && totalFilteredCount > 0 && (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Year</th>
                      <th>Team Lead</th>
                      <th>Mobile</th>
                      <th>Laptop</th>
                      <th>Team Members</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {YEAR_SECTIONS.flatMap((year) => {
                      const list = filteredData[year.key] || [];
                      return list.map((row) => {
                        const members = parseTeamMembers(row.team_members);
                        return (
                          <tr key={row.registration_id}>
                            <td>
                              <span
                                className="reg-id-badge"
                                onClick={() => copyToClipboard(row.registration_id, "ID")}
                                title="Click to copy ID"
                              >
                                {row.registration_id}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  color: year.color,
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                {year.short}
                              </span>
                            </td>
                            <td>
                              <strong>{row.team_lead_name}</strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  cursor: "pointer",
                                  color: "#93c5fd",
                                }}
                                onClick={() => copyToClipboard(row.mobile, "Mobile")}
                                title="Click to copy phone"
                              >
                                {row.mobile}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`laptop-badge ${row.laptop_availability === "Yes" ? "yes" : "no"}`}
                              >
                                {row.laptop_availability === "Yes" ? "✓ Yes" : "✗ No"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {members.map((m, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      background: "rgba(255, 255, 255, 0.05)",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                    }}
                                  >
                                    {m.name} ({m.registerNumber} - {m.section})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ color: "#71717a", fontSize: 12 }}>
                              {row.created_at || "—"}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cards View */}
            {viewMode === "cards" && (
              <>
                {YEAR_SECTIONS.map((year) => {
                  const list = filteredData[year.key] || [];
                  if (selectedYear !== "all" && selectedYear !== year.key) return null;
                  if (list.length === 0 && searchQuery) return null;

                  return (
                    <section
                      key={year.key}
                      className="year-group"
                      style={{
                        "--year-color": year.color,
                        "--year-border": year.border,
                        "--year-bg": year.badgeBg,
                      }}
                    >
                      <div className="year-group-header">
                        <div className="year-header-left">
                          <div className="year-badge-num">{year.number}</div>
                          <div>
                            <h2 className="year-header-title">{year.label} Registrations</h2>
                            <p className="year-header-sub">
                              Creative event roster for {year.label.toLowerCase()}
                            </p>
                          </div>
                        </div>

                        <div className="year-counter-badge">
                          {list.length} {list.length === 1 ? "TEAM" : "TEAMS"}
                        </div>
                      </div>

                      {list.length === 0 ? (
                        <div className="empty-state" style={{ padding: "30px 20px" }}>
                          <p style={{ margin: 0 }}>No teams registered under {year.label.toLowerCase()} yet.</p>
                        </div>
                      ) : (
                        <div className="cards-grid">
                          {list.map((row) => {
                            const members = parseTeamMembers(row.team_members);

                            return (
                              <article key={row.registration_id} className="reg-card">
                                <div>
                                  <div className="reg-card-top">
                                    <span
                                      className="reg-id-badge"
                                      onClick={() => copyToClipboard(row.registration_id, "Registration ID")}
                                      title="Click to copy registration ID"
                                    >
                                      📋 {row.registration_id}
                                    </span>

                                    <span
                                      className={`laptop-badge ${row.laptop_availability === "Yes" ? "yes" : "no"}`}
                                    >
                                      {row.laptop_availability === "Yes"
                                        ? "💻 Laptop Ready"
                                        : "⚠️ Needs Laptop"}
                                    </span>
                                  </div>

                                  <div className="leader-banner">
                                    <div className="leader-meta-title">
                                      <span>👑</span> Team Leader
                                    </div>
                                    <div className="leader-name">{row.team_lead_name || "—"}</div>
                                    <div className="leader-phone-row">
                                      <span>📞 {row.mobile || "—"}</span>
                                      <button
                                        type="button"
                                        className="copy-icon-btn"
                                        onClick={() => copyToClipboard(row.mobile, "Phone number")}
                                        title="Copy phone number"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  </div>

                                  <div className="roster-title">
                                    Team Members ({members.length})
                                  </div>

                                  <div className="roster-list">
                                    {members.map((member, i) => (
                                      <div
                                        key={`${member.registerNumber || member.name}-${i}`}
                                        className="roster-member"
                                      >
                                        <span className="member-main-name">
                                          {member.name || "—"}
                                        </span>
                                        <div className="member-pills">
                                          <span className="reg-num-tag">
                                            {member.registerNumber || "—"}
                                          </span>
                                          <span className="section-tag">
                                            Sec {member.section || "—"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="card-footer">
                                  <span>{year.label}</span>
                                  <span>{row.created_at ? new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
