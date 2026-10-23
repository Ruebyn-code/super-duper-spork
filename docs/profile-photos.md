# User profile photos

Open the blue **Account menu → User profile** to upload, replace or remove your own photo. Managers can also use the photo controls inside **Users → Edit user** for accounts they can manage. Photos have their own **Save photo** action, so previewing a file or closing the popup does not change the saved photo or other account settings.

Choose a JPG, PNG or WebP up to 5 MB. The browser shows a square centre crop and creates a bounded 512-pixel JPEG without the original file metadata. Check the preview before saving. A missing or unreadable photo uses initials. Photos appear in the account button/profile, Users directory and direct-message people/conversation avatars.

Photos are stored in the current network's private `DATA_DIR/profile-photos` folder. Keep that folder with the persistent volume and backups. Uploads require the current session and CSRF token. A user can edit their own photo; managing another user's photo retains the normal permission hierarchy and access to all of that user's locations. Photo updates do not change passwords, permissions, clock PINs, locations or active sessions. Reads require the current user, an authorised manager, shared company membership or an existing visible Comms conversation. URLs are authenticated and served without shared caching; they do not make the files public. Deleting an account removes its photo.

Saves and removals use serial, atomic revisions. If another tab changes the photo, the selected preview stays open for another explicit Save. Photo changes refresh visible avatars in the same app and other tabs in that network without discarding open forms.
