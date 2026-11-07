import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, buildQuery } from "../api";
import JobCard from "../components/JobCard";
import Icon from "../components/Icons";
import { EmptyState, ErrorBanner, PageHeader } from "../components/ui";
import { errorMessage } from "../format";
import { useMeta } from "../useMeta";

export default function JobSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const meta = useMeta();
  const queryKey = searchParams.toString();

  const current = useMemo(
    () => ({
      q: searchParams.get("q") || "",
      location: searchParams.get("location") || "",
      employment_type: searchParams.get("employment_type") || "",
      skill: searchParams.get("skill") || "",
      min_salary: searchParams.get("min_salary") || "",
      sort: searchParams.get("sort") || "newest",
      page: Number(searchParams.get("page") || 1),
    }),
    [queryKey],
  );

  const [form, setForm] = useState(current);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(current);
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get(
        `/jobs${buildQuery({
          q: current.q,
          location: current.location,
          employment_type: current.employment_type,
          skills: current.skill ? [current.skill] : undefined,
          min_salary: current.min_salary,
          sort: current.sort,
          page: current.page,
          page_size: 9,
        })}`,
      )
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [queryKey]);

  const updateParam = (updates, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "" || value === "newest") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  };

  const submit = (event) => {
    event.preventDefault();
    updateParam(form);
  };

  const change = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const clearAll = () => {
    setSearchParams(new URLSearchParams());
    setForm({ q: "", location: "", employment_type: "", skill: "", min_salary: "", sort: "newest", page: 1 });
  };

  const hasFilters = Boolean(
    current.q || current.location || current.employment_type || current.skill || current.min_salary,
  );

  const goToPage = (page) => {
    updateParam({ page }, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageWindow = useMemo(() => {
    const totalPages = data.pages || 0;
    const page = data.page || 1;
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index).filter(
      (item) => item >= 1 && item <= totalPages,
    );
  }, [data.pages, data.page]);

  return (
    <div className="container page search-page">
      <PageHeader
        eyebrow="Job discovery"
        title="Find work that fits the life you want."
        description="Search every open role on TalentHub by title, team, skill, location or salary."
      />

      <form className="search-panel" onSubmit={submit}>
        <div className="search-main-row">
          <label className="search-input">
            <Icon name="search" size={19} />
            <input
              type="search"
              placeholder="Search role, company or keyword"
              value={form.q}
              onChange={change("q")}
            />
          </label>
          <label className="search-input">
            <Icon name="pin" size={19} />
            <input
              type="search"
              placeholder="City or remote"
              value={form.location}
              onChange={change("location")}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </div>

        <div className="search-filter-row">
          <label className="filter-inline">
            <span>Type</span>
            <select value={form.employment_type} onChange={change("employment_type")}>
              <option value="">Any type</option>
              {meta.employment_types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-inline">
            <span>Skill</span>
            <input
              type="text"
              placeholder="e.g. React"
              value={form.skill}
              onChange={change("skill")}
            />
          </label>
          <label className="filter-inline">
            <span>Minimum salary</span>
            <select value={form.min_salary} onChange={change("min_salary")}>
              <option value="">Any salary</option>
              <option value="50000">$50k+</option>
              <option value="80000">$80k+</option>
              <option value="100000">$100k+</option>
              <option value="130000">$130k+</option>
            </select>
          </label>
          <label className="filter-inline">
            <span>Sort by</span>
            <select value={form.sort} onChange={change("sort")}>
              <option value="newest">Newest</option>
              <option value="deadline">Closing soon</option>
              <option value="salary">Highest salary</option>
            </select>
          </label>
          {hasFilters ? (
            <button type="button" className="clear-filters" onClick={clearAll}>
              <Icon name="close" size={14} /> Clear filters
            </button>
          ) : null}
        </div>
      </form>

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="results-head">
        <div>
          <strong>{loading ? "Searching…" : `${data.total} role${data.total === 1 ? "" : "s"} found`}</strong>
          {hasFilters ? <span className="muted"> matching your filters</span> : null}
        </div>
        {current.q ? <span className="results-query">“{current.q}”</span> : null}
      </div>

      {loading ? (
        <div className="job-grid job-grid-two">
          {[1, 2, 3, 4].map((item) => (
            <div className="skeleton-card" key={item} />
          ))}
        </div>
      ) : data.items.length ? (
        <>
          <div className="job-grid job-grid-two">
            {data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {data.pages > 1 ? (
            <nav className="pagination" aria-label="Job results pages">
              <button
                type="button"
                className="page-button"
                disabled={data.page <= 1}
                onClick={() => goToPage(data.page - 1)}
              >
                <Icon name="arrowLeft" size={15} /> Prev
              </button>
              {pageWindow.map((page) => (
                <button
                  type="button"
                  key={page}
                  className={`page-button ${page === data.page ? "active" : ""}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className="page-button"
                disabled={data.page >= data.pages}
                onClick={() => goToPage(data.page + 1)}
              >
                Next <Icon name="arrowRight" size={15} />
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="search"
          title="No roles match that search"
          description="Try removing a filter or searching for a broader skill, team or location."
          action={
            hasFilters ? (
              <button type="button" className="btn btn-secondary" onClick={clearAll}>
                Clear all filters
              </button>
            ) : (
              <Link to="/" className="btn btn-secondary">
                Back to home
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
