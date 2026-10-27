import { useState, useEffect } from "react";

const STORAGE_KEY = "tasks";
const PRIORITIES = ["low", "medium", "high"];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const NEW_TASK = { title: "", due: null, priority: "medium", category: "General" };
const DEFAULT_CATEGORIES = ["General", "Work", "Home", "Study", "Personal"];
const NEW_CATEGORY = "__new__";

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ---- Dates ----
// Dates are stored as "YYYY-MM-DD". "Today" is built from local time on purpose:
// toISOString() uses UTC and can give the wrong day late in the evening.
function pad(n) {
  return String(n).padStart(2, "0");
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayKey() {
  return dateKey(new Date());
}
function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}
function prettyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// What to show next to a task's due date
function dueInfo(task) {
  if (!task.due) return null;
  const today = todayKey();
  if (task.due === today) return { text: "Today", overdue: false };
  if (task.due === tomorrowKey()) return { text: "Tomorrow", overdue: false };
  if (task.due < today && !task.done) {
    return { text: `Overdue, ${prettyDate(task.due)}`, overdue: true };
  }
  return { text: prettyDate(task.due), overdue: false };
}

// ---- Sorting ----
function sortTasks(list, sortBy) {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sortBy === "due" && a.due !== b.due) {
      if (!a.due) return 1; // tasks without a date go last
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    }
    if (sortBy === "priority") {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (diff) return diff;
    }
    return b.createdAt.localeCompare(a.createdAt); // newest first
  });
  return copy;
}

// ---- The form used for adding, editing and the AI preview ----
function TaskForm({ initial, categories, submitLabel, onSubmit, onCancel, resetOnSubmit }) {
  const [title, setTitle] = useState(initial.title);
  const [due, setDue] = useState(initial.due || "");
  const [priority, setPriority] = useState(initial.priority);
  const [category, setCategory] = useState(initial.category);
  const [newCategory, setNewCategory] = useState("");
  const creating = category === NEW_CATEGORY;

  function handleSubmit(e) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const finalCategory = creating ? newCategory.trim() || "General" : category;
    onSubmit({
      title: cleanTitle,
      due: due || null,
      priority,
      category: finalCategory,
    });
    if (resetOnSubmit) {
      setTitle("");
      setDue("");
      setPriority("medium");
      setNewCategory("");
      if (creating) setCategory(finalCategory); // keep the new category selected
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="title-line">
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Task title"
        />
        <button type="submit" className="primary">{submitLabel}</button>
        {onCancel && (
          <button type="button" className="link" onClick={onCancel}>Cancel</button>
        )}
      </div>
      <div className="details-line">
        <label>
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={NEW_CATEGORY}>+ New category...</option>
          </select>
        </label>
        {creating && (
          <label>
            Name
            <input
              className="new-cat"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              maxLength={30}
              placeholder="e.g. Gym"
              autoFocus
            />
          </label>
        )}
      </div>
    </form>
  );
}

// ---- Type a sentence, check what the AI understood, then add it ----
function SmartAdd({ categories, onConfirm, onPreviewChange }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [runs, setRuns] = useState(0); // changes the preview form's key so it resets for each new result

  // tell the page whether a preview is open
  useEffect(() => {
    onPreviewChange(Boolean(preview));
  }, [preview, onPreviewChange]);

  async function handleParse(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || loading) return;

    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, today: todayKey(), categories }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.task) {
        throw new Error(data.error || "Could not reach the server. Is it running?");
      }
      setPreview(data.task);
      setRuns((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof TypeError ? "Could not reach the server. Is it running?" : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  // the AI may suggest a category the list doesn't have yet
  const previewCategories =
    preview && !categories.includes(preview.category)
      ? [...categories, preview.category]
      : categories;

  return (
    <section className="smart">
      <p className="field-label">Say it in a sentence</p>
      <form className="title-line" onSubmit={handleParse}>
        <input
          className="title-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. send the invoice to Mika on Friday, it's urgent"
          aria-label="Describe a task in your own words"
          maxLength={300}
        />
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Reading..." : "Add with AI"}
        </button>
      </form>

      {error && <p className="error-note">{error}</p>}

      {preview && (
        <div className="preview">
          <p className="preview-label">Here's what I understood. Fix anything that's off:</p>
          <TaskForm
            key={runs}
            initial={preview}
            categories={previewCategories}
            submitLabel="Add task"
            onSubmit={(values) => {
              onConfirm(values);
              setPreview(null);
              setText("");
            }}
            onCancel={() => setPreview(null)}
          />
        </div>
      )}
    </section>
  );
}

// ---- The AI's suggested steps: untick or edit, then add the ones you want ----
function BreakdownProposal({ steps, onAdd, onCancel }) {
  const [items, setItems] = useState(() => steps.map((text) => ({ text, keep: true })));

  function change(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const chosen = items.filter((it) => it.keep && it.text.trim()).map((it) => it.text.trim());

  return (
    <div className="proposal">
      <p className="preview-label">Suggested steps. Untick or edit any you don't want:</p>
      {items.map((it, i) => (
        <div className="step" key={i}>
          <input
            type="checkbox"
            checked={it.keep}
            onChange={(e) => change(i, { keep: e.target.checked })}
            aria-label={`Include step ${i + 1}`}
          />
          <input
            className="step-input"
            value={it.text}
            onChange={(e) => change(i, { text: e.target.value })}
            maxLength={100}
            aria-label={`Step ${i + 1}`}
          />
        </div>
      ))}
      <div className="proposal-actions">
        <button className="primary" disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
          Add {chosen.length} step{chosen.length === 1 ? "" : "s"}
        </button>
        <button className="link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onBreakdown,
  breakdownBusy,
  onToggleSub,
  onDeleteSub,
  children,
}) {
  const due = dueInfo(task);
  const subs = task.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;

  return (
    <li className={`task${task.done ? " done" : ""}`}>
      <div className="task-main">
        <label>
          <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
          <span className="task-text">
            <span className="task-title">{task.title}</span>
            <span className="task-meta">
              {due && <span className={due.overdue ? "due overdue-text" : "due"}>{due.text}</span>}
              {task.priority !== "medium" && (
                <span className={`prio prio-${task.priority}`}>{task.priority}</span>
              )}
              {task.category !== "General" && <span className="cat">{task.category}</span>}
              {subs.length > 0 && <span>{doneSubs}/{subs.length} steps</span>}
            </span>
          </span>
        </label>
        <div className="actions">
          {!task.done && (
            <button className="link" onClick={() => onBreakdown(task)} disabled={breakdownBusy}>
              Break down
            </button>
          )}
          <button className="link" onClick={() => onEdit(task.id)}>Edit</button>
          <button className="delete" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>
            Delete
          </button>
        </div>
      </div>

      {subs.length > 0 && (
        <ul className="subtasks">
          {subs.map((s) => (
            <li key={s.id} className={s.done ? "sub done" : "sub"}>
              <label>
                <input type="checkbox" checked={s.done} onChange={() => onToggleSub(task.id, s.id)} />
                <span>{s.title}</span>
              </label>
              <button className="delete" onClick={() => onDeleteSub(task.id, s.id)} aria-label={`Remove step ${s.title}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {children}
    </li>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [editingId, setEditingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const [previewing, setPreviewing] = useState(false);
  // { taskId, status: "loading" | "ready" | "error", steps?, message? } or null
  const [breakdown, setBreakdown] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // storage unavailable: tasks just won't survive a refresh
    }
  }, [tasks]);

  function addTask(values) {
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...values,
        done: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function updateTask(id, values) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...values } : t)));
  }

  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setBreakdown((prev) => (prev && prev.taskId === id ? null : prev));
  }

  // ---- Subtasks ----
  function addSubtasks(taskId, titles) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [
                ...(t.subtasks || []),
                ...titles.map((title) => ({ id: crypto.randomUUID(), title, done: false })),
              ],
            }
          : t
      )
    );
    setBreakdown(null);
  }

  function toggleSubtask(taskId, subId) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      )
    );
  }

  function deleteSubtask(taskId, subId) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t
      )
    );
  }

  // ---- Ask the AI to break a task down ----
  async function startBreakdown(task) {
    setBreakdown({ taskId: task.id, status: "loading" });
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.subtasks) {
        throw new Error(data.error || "Could not reach the server. Is it running?");
      }
      // only apply the result if this task is still the one waiting
      setBreakdown((prev) =>
        prev && prev.taskId === task.id && prev.status === "loading"
          ? { taskId: task.id, status: "ready", steps: data.subtasks }
          : prev
      );
    } catch (err) {
      const message =
        err instanceof TypeError ? "Could not reach the server. Is it running?" : err.message;
      setBreakdown((prev) =>
        prev && prev.taskId === task.id && prev.status === "loading"
          ? { taskId: task.id, status: "error", message }
          : prev
      );
    }
  }

  // categories in use (for the filter) and the full list for the forms
  const categories = [...new Set(["General", ...tasks.map((t) => t.category)])].sort();
  const formCategories = [
    ...DEFAULT_CATEGORIES,
    ...categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];
  // if the chosen category no longer exists (all its tasks were deleted), show everything
  const activeCategory = categories.includes(filterCategory) ? filterCategory : "all";

  const visible = tasks.filter(
    (t) =>
      (activeCategory === "all" || t.category === activeCategory) &&
      (filterPriority === "all" || t.priority === filterPriority)
  );
  const open = sortTasks(visible.filter((t) => !t.done), sortBy);
  const done = sortTasks(visible.filter((t) => t.done), "newest");

  const today = todayKey();
  const openCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - openCount;
  const overdueCount = tasks.filter((t) => !t.done && t.due && t.due < today).length;
  const breakdownBusy = breakdown?.status === "loading";

  function renderPanel(t) {
    if (!breakdown || breakdown.taskId !== t.id) return null;
    if (breakdown.status === "loading") {
      return <p className="breakdown-note">Breaking it down...</p>;
    }
    if (breakdown.status === "error") {
      return (
        <p className="error-note">
          {breakdown.message}{" "}
          <button className="link" onClick={() => setBreakdown(null)}>Close</button>
        </p>
      );
    }
    return (
      <BreakdownProposal
        steps={breakdown.steps}
        onAdd={(titles) => addSubtasks(t.id, titles)}
        onCancel={() => setBreakdown(null)}
      />
    );
  }

  function renderTask(t) {
    if (t.id === editingId) {
      return (
        <li key={t.id} className="task editing">
          <TaskForm
            initial={t}
            categories={formCategories}
            submitLabel="Save"
            onSubmit={(values) => {
              updateTask(t.id, values);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }
    return (
      <TaskRow
        key={t.id}
        task={t}
        onToggle={toggleTask}
        onEdit={setEditingId}
        onDelete={deleteTask}
        onBreakdown={startBreakdown}
        breakdownBusy={breakdownBusy}
        onToggleSub={toggleSubtask}
        onDeleteSub={deleteSubtask}
      >
        {renderPanel(t)}
      </TaskRow>
    );
  }

  return (
    <main className="page">
      <h1>Tasks</h1>
      <p className="summary">
        {openCount} to do, {doneCount} done
        {overdueCount > 0 && `, ${overdueCount} overdue`}
      </p>

      <SmartAdd categories={formCategories} onConfirm={addTask} onPreviewChange={setPreviewing} />

      {!previewing && (
        <>
          <p className="field-label">Or fill it in yourself</p>
          <TaskForm
            initial={NEW_TASK}
            categories={formCategories}
            submitLabel="Add"
            onSubmit={addTask}
            resetOnSubmit
          />
        </>
      )}

      {tasks.length > 0 && (
        <div className="toolbar">
          <label>
            Show
            <select value={activeCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">all categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="all">all priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="due">due date</option>
              <option value="priority">priority</option>
              <option value="newest">newest</option>
            </select>
          </label>
        </div>
      )}

      {tasks.length === 0 && (
        <p className="empty">Nothing on the list. Enjoy it, or add something above.</p>
      )}
      {tasks.length > 0 && visible.length === 0 && (
        <p className="empty">No tasks match these filters.</p>
      )}

      <ul className="list">{open.map(renderTask)}</ul>

      {done.length > 0 && (
        <>
          <h2>Done</h2>
          <ul className="list">{done.map(renderTask)}</ul>
        </>
      )}
    </main>
  );
}