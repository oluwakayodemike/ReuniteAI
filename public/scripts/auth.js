let notificationsInitialized = false;

window.addEventListener("load", async function () {
  const Clerk = window.Clerk;

  try {
    await Clerk.load();
    console.log("clerk is loaded and ready!");

    const userButtonDiv = document.getElementById("user-button");
    const signedInNav = document.getElementById("signed-in-nav");
    const signedOutNav = document.getElementById("signed-out-nav");
    const loginButton = document.getElementById("login-button");
    const signupButton = document.getElementById("signup-button");

    function updateNav() {
      if (Clerk.user) {
        signedOutNav.style.display = "none";
        signedInNav.style.display = "flex";
        if (userButtonDiv && !userButtonDiv.hasChildNodes()) {
          Clerk.mountUserButton(userButtonDiv);
        }
        if (!notificationsInitialized) {
          initializeNotifications();
          notificationsInitialized = true;
        }
      } else {
        signedInNav.style.display = "none";
        signedOutNav.style.display = "flex";
        notificationsInitialized = false;
      }
    }

    updateNav();

    Clerk.addListener(() => {
      console.log("Auth state changed, updating UI");
      updateNav();
    });

    if (loginButton) {
      loginButton.addEventListener("click", (e) => {
        e.preventDefault();
        Clerk.openSignIn();
      });
    }
    if (signupButton) {
      signupButton.addEventListener("click", (e) => {
        e.preventDefault();
        Clerk.openSignUp();
      });
    }
  } catch (err) {
    console.error("Clerk failed to load", err);
  }
});


async function initializeNotifications() {
  const notifIcon = document.querySelector('.notification-icon');
  const dropdown = document.getElementById('notification-dropdown');
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');

  function formatNotificationDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  notifIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      fetchNotifications();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !notifIcon.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  async function fetchNotifications() {
    try {
      const token = await Clerk.session.getToken();
      const response = await fetch('http://localhost:3001/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const { notifications } = await response.json();

      list.innerHTML = '';
      let unreadCount = 0;

      if (notifications.length === 0) {
        list.innerHTML = '<li class="no-notifications">You have no new notifications!</li>';
      } else {
        notifications.forEach(notif => {
          if (!notif.is_read) unreadCount++;

          const li = document.createElement('li');
          li.className = `notification-item ${!notif.is_read ? 'unread' : ''}`;
          
          const avatarIcon = '<i class="fa-solid fa-bell"></i>'; 

          li.innerHTML = `
            <div class="notif-avatar">${avatarIcon}</div>
            <div class="notif-content">
              <p class="notif-text">${notif.message}</p>
              <p class="notif-time">${formatNotificationDate(notif.created_at)}</p>
            </div>
            ${!notif.is_read ? '<div class="unread-dot"></div>' : ''}
          `;

          li.addEventListener('click', async () => {
            await markAsRead(notif.id);
            window.location.href = `./search-result.html?lostItemId=${notif.lost_item_id}`;
          });

          list.appendChild(li);
        });
      }

      badge.textContent = unreadCount;
      if (unreadCount > 0) {
        badge.classList.add('visible');
      } else {
        badge.classList.remove('visible');
      }

    } catch (error) {
      console.error('Error fetching notifications:', error);
      list.innerHTML = '<li class="no-notifications">Could not load notifications.</li>';
    }
  }

  async function markAsRead(notificationId) {
    try {
      const token = await Clerk.session.getToken();
      await fetch(`http://localhost:3001/api/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
  
  fetchNotifications();
  setInterval(fetchNotifications, 60000);
}