function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  return hours + ":" + minutes + " " + ampm;
}

function getDateGroup(date, now = new Date()) {
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  // Check if within past 7 days
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  if (date >= startOfWeek) {
    return "This Week";
  }

  return "Older";
}

function getUiType(type) {
  if (type === "REVIEW") return "likes";
  return "alerts";
}

function mapNotification(notification, now = new Date()) {
  if (!notification) return null;

  return {
    id: notification.id,
    type: notification.type,
    uiType: getUiType(notification.type),
    title: notification.title,
    description: notification.message,
    message: notification.message,
    data: notification.data || {},
    actionUrl: notification.actionUrl || null,
    read: notification.readAt !== null,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
    time: formatTime(notification.createdAt),
    dateGroup: getDateGroup(notification.createdAt, now),
  };
}

module.exports = {
  mapNotification,
};
