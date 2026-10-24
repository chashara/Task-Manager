import { useState, useEffect } from "react";

const STORAGE_KEY = "tasks";

// Read saved tasks when the app starts
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <li className={task.done ? "task done" : "task"}>
      <label>
        <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
        <span className="task-title">{task.title}</span>
      </label>
      <button className="delete" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>
        Delete
      </button>
    </li>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [title, setTitle] = useState("");

  // Save every time the task list changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // storage unavailable: tasks just won't survive a refresh
    }
  }, [tasks]);

  function addTask(e) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: clean,
        due: null,
        priority: "medium",
        category: "General",
        done: false,
        subtasks: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setTitle("");
  }

  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <main className="page">
      <h1>Task Manager</h1>
      <p className="summary">
        {open.length} open, {done.length} done
      </p>

      <form className="add" onSubmit={addTask}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task"
          aria-label="New task"
        />
        <button type="submit">Add</button>
      </form>

      {tasks.length === 0 && <p className="empty">Nothing here yet. Add your first task above.</p>}

      <ul className="list">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <h2>Done</h2>
          <ul className="list">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}