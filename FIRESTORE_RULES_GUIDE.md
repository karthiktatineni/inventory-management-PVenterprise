# How to Fix "Seeding Failed: Check Firestore Rules" & Load Products

The database is blocking the application from saving/reading the products because Firebase Firestore is currently in "Locked Mode" (the default secure mode).

**To fix this immediately:**

1. Go to your [Firebase Console](https://console.firebase.google.com/) and open your **Inventory Management** project.
2. In the left sidebar, click on **Firestore Database**.
3. Click on the **Rules** tab at the top.
4. Replace all the code inside the editor with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Allows read & write ONLY if the user is logged in
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Click the **Publish** button.

### Done with Firestore! What's next?

If you want to use the **Product Photo/Image Uploading** feature in the application, you also need to unlock Firebase Storage!

1. In your Firebase Console, click on **Storage** on the left menu (you may need to click "Get Started" if you haven't used it yet).
2. Go to the **Rules** tab.
3. Replace the code with this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish**.

### You are all set! 🎉
Go back to your **Main Panel** and click **Seed Initial Stock** or go to the **Stock & Add Products** panel and try uploading products with photos. They will instantly load into your billing dashboard and for your workers!
