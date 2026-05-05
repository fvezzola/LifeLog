// Optional periodic notifications nudging the user to log something.

let reminderTimer = null;

export function toggleReminder() {
  const on = document.getElementById('reminder-toggle').checked;
  localStorage.setItem('ll_reminderon', on);
  if (on) { requestNotifPermission(); startReminder(); }
  else stopReminder();
}

async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default')
    await Notification.requestPermission();
}

export function startReminder() {
  stopReminder();
  const mins = parseInt(document.getElementById('reminder-mins').value) || 120;
  localStorage.setItem('ll_remindermins', mins);
  reminderTimer = setInterval(() => {
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('LifeLog', { body: "What's happening right now? Log it." });
  }, mins * 60000);
  document.getElementById('reminder-status').textContent = `next in ${mins}min`;
}

export function stopReminder() {
  if (reminderTimer) clearInterval(reminderTimer);
  document.getElementById('reminder-status').textContent = 'off';
}
