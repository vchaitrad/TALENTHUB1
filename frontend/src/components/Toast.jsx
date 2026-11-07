import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icons";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => dismiss(id), 4600);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              <Icon name={toast.type === "success" ? "check" : "close"} size={16} />
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
