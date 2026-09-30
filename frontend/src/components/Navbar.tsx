import { Search, CalendarDays, X } from "lucide-react";
import ConfigPopover from "./shell/ConfigPopover";

interface NavbarProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  dateFilter?: string;
  /** "YYYY-MM" month filter. Only rendered when a setter is supplied. */
  setDateFilter?: (month: string) => void;
  /** Breadcrumb shown on pages that have no search box. */
  crumb?: string;
}

// Top toolbar of the editor pane. On the home page it carries search and the
// month filter; elsewhere it shows a breadcrumb. The gear (Config) is always there.
const Navbar = ({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  crumb,
}: NavbarProps) => {
  return (
    <div className="flex items-center gap-2 px-3 md:px-5 py-3 border-b ide-divider shrink-0">
      {setSearchQuery ? (
        <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
          <label className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
            <input
              type="text"
              value={searchQuery || ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="String.prototype.search(...)"
              aria-label="Search notes"
              className="ide-input !pl-9 !pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </label>

          {setDateFilter && (
            <label
              className="flex items-center gap-1 ide-input !w-auto !py-0 !pr-1 h-[38px] shrink-0"
              title="Filter by month. (Yes, in JS months are 0-indexed. Not here though.)"
            >
              <CalendarDays className="size-4 text-[var(--fg-dim)] mr-1" />
              <span className="tok-kw hidden sm:inline">new</span>
              <span className="tok-fn hidden sm:inline">&nbsp;Date</span>
              <span className="tok-punc hidden sm:inline">(</span>
              <input
                type="month"
                value={dateFilter || ""}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by month"
                className="bg-transparent outline-none text-[13px] text-[var(--str)] w-[130px]"
              />
              <span className="tok-punc hidden sm:inline">)</span>
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="ml-1 text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  aria-label="Clear month filter"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0 text-[13px] truncate">
          <span className="tok-dim">~/root/</span>
          <span className="text-[var(--fg)]">{crumb}</span>
        </div>
      )}

      <ConfigPopover />
    </div>
  );
};

export default Navbar;
