"use client";

import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Agent",
  message = "Are you sure you want to delete this agent?",
  confirmText = "Delete",
  cancelText = "Cancel",
  agentName = "",
  chatCount = 0
}) {
  if (!isOpen) return null;

  const showChatWarning = chatCount > 0;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Message */}
            <div className="mb-5">
              <p className="text-gray-700">
                {message} {agentName && (
                  <span className="font-semibold text-gray-900">"{agentName}"</span>
                )}
              </p>
              
              {/* Chat warning if applicable */}
              {showChatWarning && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This agent has <span className="font-semibold">{chatCount} chat(s)</span>. 
                    These chats will also be deleted.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-medium rounded-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-sm hover:shadow"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}