import { useEffect, useState } from 'react';

export default function BrowserSettingsAlert() {
    const [showAlert, setShowAlert] = useState(false);
    const [browserName, setBrowserName] = useState('');

    useEffect(() => {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox')) setBrowserName('Firefox');
        else if (ua.includes('Edg')) setBrowserName('Edge');
        else if (ua.includes('Chrome')) setBrowserName('Chrome');

        const testStorage = async () => {
            try {
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                    const estimate = await navigator.storage.estimate();
                    if (estimate.usage === undefined) {
                        setShowAlert(true);
                    }
                }
            } catch (err) {
                setShowAlert(true);
            }
        };
        testStorage();
    }, []);

    if (!showAlert) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-lg max-w-md">
            <h3 className="font-bold text-yellow-800">⚠️ Browser Storage Restricted</h3>
            <p className="text-sm text-yellow-700 mt-2 mb-3">
                Your browser ({browserName}) is blocking storage access. Please enable cookies and site data for this website in your browser settings.
            </p>
            <button 
                onClick={() => setShowAlert(false)}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
            >
                I'll enable it
            </button>
        </div>
    );
}