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

    if (Clerk.user) {
      initializeNotifications();
    }

    function updateNav() {
      if (Clerk.user) {
        signedOutNav.style.display = "none";
        signedInNav.style.display = "flex";
        if (userButtonDiv && !userButtonDiv.hasChildNodes()) {
          Clerk.mountUserButton(userButtonDiv);
        }
      } else {
        signedInNav.style.display = "none";
        signedOutNav.style.display = "flex";
      }
    }

    updateNav();

    Clerk.addListener(({ user }) => {
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
  
  notifIcon.addEventListener('click', () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    if (dropdown.style.display === 'block') {
      fetchNotifications();
    }
  });

  document.addEventListener('click', (e) => {
    if (!notifIcon.contains(e.target) && !dropdown.contains(e.target)) {
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
        const li = document.createElement('li');
        li.className = 'no-notifications';
        li.textContent = 'Nothing to see here!';
        list.appendChild(li);
      } else {
        notifications.forEach(notif => {
          const li = document.createElement('li');
          li.className = notif.is_read ? '' : 'unread';
          li.innerHTML = `
            <p>${notif.message}</p>
            <small>${new Date(notif.created_at).toLocaleString()}</small>
          `;

          li.addEventListener('click', async () => {
            await markRead(notif.id);
            window.location.href = `./search-result.html?lostItemId=${notif.lost_item_id}`;
          });
          list.appendChild(li);
          if (!notif.is_read) unreadCount++;
        });
      }

      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
    } catch (error) {
      console.error('Error fetching notifications:', error);
      list.innerHTML = '<li class="no-notifications">Error loading notifications.</li>';
    }
  }

  async function markRead(notificationId) {
    try {
      const token = await Clerk.session.getToken();
      await fetch('http://localhost:3001/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notificationId })
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking read:', error);
    }
  }
  
  fetchNotifications();
  setInterval(fetchNotifications, 30000);
}