// import { useEffect, useState } from 'react';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'; // Adjust if you don't use shadcn
// import { Button } from '@/components/ui/button';

// export default function PermissionManager() {
//   const [showPopupAlert, setShowPopupAlert] = useState(false);
//   const [notificationStatus, setNotificationStatus] = useState(Notification.permission);

//   useEffect(() => {
//     // 1. Check for Pop-up Blocker
//     const testPopup = window.open('', '_blank', 'width=1,height=1,left=0,top=0');
//     if (!testPopup || testPopup.closed || typeof testPopup.closed === 'undefined') {
//       setShowPopupAlert(true); // Pop-ups are blocked
//     } else {
//       testPopup.close();
//     }

//     // 2. Request Notification Permission (Native Browser Prompt)
//     // This is required for Background Sync to alert the user
//     if ('Notification' in window && Notification.permission === 'default') {
//       Notification.requestPermission().then((permission) => {
//         setNotificationStatus(permission);
//       });
//     }
//   }, []);

//   const enablePopups = () => {
//     // This opens a small window to trigger the browser's native "Allow pop-ups" UI
//     const popup = window.open('about:blank', '_blank');
//     if (popup) {
//       popup.close();
//       setShowPopupAlert(false);
//     }
//   };

//   return (
//     <>
//       {/* Pop-up Blocker Alert */}
//       {showPopupAlert && (
//         <div className="fixed bottom-4 right-4 z-50 bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-lg max-w-sm">
//           <h3 className="font-bold text-yellow-800">Pop-ups Blocked</h3>
//           <p className="text-sm text-yellow-700 mt-1">
//             Please allow pop-ups and redirects for this site to ensure all features work correctly.
//           </p>
//           <button 
//             onClick={enablePopups}
//             className="mt-2 bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
//           >
//             Allow Pop-ups
//           </button>
//         </div>
//       )}

//       {/* Background Sync Status (Optional UI) */}
//       {notificationStatus === 'granted' && (
//         <div className="fixed bottom-4 left-4 z-50 bg-green-50 border border-green-200 p-2 rounded text-xs text-green-700">
//           ✅ Background Sync & Notifications Enabled
//         </div>
//       )}
//     </>
//   );
// }

import { useEffect, useState } from 'react';

export default function PermissionManager() {
  const [showPopupAlert, setShowPopupAlert] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(Notification.permission);

  useEffect(() => {
    // 1. Check for Pop-up Blocker
    const testPopup = window.open('', '_blank', 'width=1,height=1,left=0,top=0');
    if (!testPopup || testPopup.closed || typeof testPopup.closed === 'undefined') {
      setShowPopupAlert(true);
    } else {
      testPopup.close();
    }

    // 2. ✅ FIX: Request Notification Permission on First User Click
    const handleFirstClick = () => {
      const alreadyRequested = localStorage.getItem('notification_permission_requested');
      
      if (Notification.permission === 'default' && !alreadyRequested) {
        Notification.requestPermission().then((permission) => {
          localStorage.setItem('notification_permission_requested', 'true');
          setNotificationStatus(permission);
          console.log('🔔 Notification permission result:', permission);
        });
      }
      // Remove listener after first click
      document.removeEventListener('click', handleFirstClick);
    };

    // Attach listener
    document.addEventListener('click', handleFirstClick);

    return () => {
      document.removeEventListener('click', handleFirstClick);
    };
  }, []);

  const enablePopups = () => {
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.close();
      setShowPopupAlert(false);
    }
  };

  return (
    <>
      {showPopupAlert && (
        <div className="fixed bottom-4 right-4 z-50 bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-lg max-w-sm">
          <h3 className="font-bold text-yellow-800">Pop-ups Blocked</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Please allow pop-ups and redirects for this site.
          </p>
          <button 
            onClick={enablePopups}
            className="mt-2 bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
          >
            Allow Pop-ups
          </button>
        </div>
      )}
    </>
  );
}