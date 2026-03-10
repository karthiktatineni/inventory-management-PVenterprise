# How to Setup Supabase Image Uploads 🚀

You've decided to use **Supabase** exclusively for image storage while keeping Firebase for everything else! That's a great combination! Here is exactly how to link it:

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com/) and sign in.
2. Click **New Project** and create one (give it any name and password, the free tier is fine).

### Step 2: Create the Storage Bucket
1. Inside your new Supabase project dashboard, click on **Storage** on the left menu.
2. Click **New Bucket**.
3. Name the bucket exactly: `products`
4. **CRITICAL:** Make sure you toggle the **"Public bucket"** switch to ON, so your images can be viewed inside your app without needing secure tokens every time!
5. Hit **Save**.

### Step 3: Link it to your App
1. Go to the **Project Settings** (the gear icon `⚙️` at the bottom left) in Supabase.
2. Click on **API** in the menu.
3. You will see your **Project URL** and your **anon / public key**.
4. Now, open the `src/supabase.js` file in your code editor.
5. Replace the placeholder text at lines 6 and 7 with your real URL and Key from Supabase!

It should look like this:
```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxxxxxx.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsIn...';
```

### You are all done!
Restart your app using `npm run dev`. You can now upload as many photos as you want into the **Stock & Add Products** panel and they will be instantly delivered via Supabase!
