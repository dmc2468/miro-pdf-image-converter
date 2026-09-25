"use client";
import { useEffect, useState } from "react";
import { makePlan, type PlannerRow, type PlannerSettings } from "../../shared/stringing-scheduling";
import { dueReminders } from "../../shared/stringing-scheduling";
const enabledKey = "stringing-reminders-enabled", sentKey = "stringing-reminders-sent";
export function PlannerReminders({ rows, settings, ready }: {
    rows: PlannerRow[];
    settings: PlannerSettings;
    ready: boolean;
}) {
    const [enabled, setEnabled] = useState(false), [permission, setPermission] = useState<string>("default"), [error, setError] = useState("");
    useEffect(() => { setPermission("Notification" in window ? Notification.permission : "unsupported"); try {
        setEnabled(localStorage.getItem(enabledKey) === "true");
    }
    catch {
        setError("Reminder preferences could not be saved.");
    } }, []);
    useEffect(() => {
        if (!ready || !enabled || permission !== "granted")
            return;
        function check() {
            try {
                const now = new Date(), sent: Record<string, number> = JSON.parse(localStorage.getItem(sentKey) || "{}");
                for (const [id, time] of Object.entries(sent))
                    if (now.getTime() - time > 7 * 86400000)
                        delete sent[id];
                for (const reminder of dueReminders(makePlan(rows, settings, now), now)) {
                    if (sent[reminder.id])
                        continue;
                    const notification = new Notification(reminder.title, { body: reminder.body, tag: reminder.id });
                    notification.onclick = () => { window.focus(); notification.close(); };
                    sent[reminder.id] = now.getTime();
                }
                localStorage.setItem(sentKey, JSON.stringify(sent));
            }
            catch {
                setError("Notifications could not be sent. Check your browser notification settings.");
            }
        }
        check();
        const timer = setInterval(check, 15000);
        window.addEventListener("focus", check);
        return () => { clearInterval(timer); window.removeEventListener("focus", check); };
    }, [rows, settings, ready, enabled, permission]);
    async function toggle() {
        try {
            if (enabled) {
                localStorage.setItem(enabledKey, "false");
                setEnabled(false);
                return;
            }
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === "granted") {
                localStorage.setItem(enabledKey, "true");
                setEnabled(true);
                setError("");
            }
        }
        catch {
            setError("Notifications are unavailable in this browser.");
        }
    }
    return <div className="reminder-control"><button onClick={toggle} disabled={permission === "unsupported" || permission === "denied"}>{enabled && permission === "granted" ? "Turn off reminders" : "Enable one-hour reminders"}</button><span>{error || (permission === "unsupported" ? "Open in a browser that supports notifications." : permission === "denied" ? "Allow notifications in your browser\u2019s site settings to enable reminders." : "Collection, stringing and drop-off reminders. Keep the app open and your device awake.")}</span></div>;
}
