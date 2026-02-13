import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Simple, clean toast styles
export const toastStyles = `
  .Toastify__toast {
    border-radius: 16px !important;
    padding: 12px 16px !important;
    font-family: inherit !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.02) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    background: white !important;
    margin-bottom: 8px !important;
  }
  
  .Toastify__toast-body {
    padding: 0 !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    color: #1f2937 !important;
  }
  
  .Toastify__progress-bar {
    height: 3px !important;
    border-bottom-left-radius: 16px !important;
    border-bottom-right-radius: 16px !important;
  }
`;

// ToastContainer props - simple top-right
export const toastContainerProps = {
  position: "top-right",
  autoClose: 3500,
  hideProgressBar: false,
  newestOnTop: true,
  closeOnClick: true,
  rtl: false,
  pauseOnFocusLoss: true,
  draggable: true,
  pauseOnHover: true,
  theme: "light",
  limit: 4,
  className: '!top-4 !right-4',
  toastClassName: '!mb-2 !rounded-2xl !shadow-lg',
  progressClassName: '!h-1 !rounded-b-2xl',
};

// Clean toast functions
export const showToast = {
  success: (message) => toast.success(message, {
    icon: '',
    className: '!border !border-emerald-200 !bg-white',
    progressClassName: '!bg-emerald-500',
  }),

  error: (message) => toast.error(message, {
    icon: '',
    className: '!border !border-red-200 !bg-white',
    progressClassName: '!bg-red-500',
  }),

  warning: (message) => toast.warning(message, {
    icon: '',
    className: '!border !border-amber-200 !bg-white',
    progressClassName: '!bg-amber-500',
  }),

  info: (message) => toast.info(message, {
    icon: '',
    className: '!border !border-blue-200 !bg-white',
    progressClassName: '!bg-blue-500',
  }),

  agent: (message) => toast(message, {
    icon: '',
    className: '!border !border-purple-200 !bg-white !text-purple-700',
    progressClassName: '!bg-purple-500',
  }),

  confirm: (title, message, onConfirm, onCancel) => {
    const toastId = toast.info(
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={() => {
              onConfirm();
              toast.dismiss(toastId);
            }}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
          >
            Yes
          </button>
          <button
            onClick={() => toast.dismiss(toastId)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
          >
            No
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        draggable: false,
        closeButton: false,
        icon: '🤔',
        className: '!bg-white !border !border-purple-200 !shadow-xl !rounded-2xl !p-4 !w-[300px]',
      }
    );
    return toastId;
  },
};