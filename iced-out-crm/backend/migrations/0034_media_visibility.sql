-- Media that is not for everybody.
--
-- WHAT IS TRUE TODAY.
--
-- `GET /media/{id}` is a PUBLIC route and serves any asset whose id is asked
-- for. That is right for product photography, which is the overwhelming
-- majority of what the store holds, and it is not right for the one category
-- sitting beside it: customer profile photos.
--
-- The saving grace is that ids are unguessable — `med-` plus sixteen hex
-- characters, from `random_bytes(8)`. Sixty-four bits is not enumerable, so
-- nothing here is currently exposed and nothing is leaking. But an unguessable
-- URL is a capability, not an authorisation: anyone who is ever handed the link
-- keeps it, a referrer or a shared screenshot passes it on, and there is no way
-- to take it back short of deleting the file.
--
-- WHAT THIS COLUMN CHANGES.
--
-- `visibility = 'private'` makes the media endpoint require a session that owns
-- the asset. `'public'` is the default and every existing row keeps it, so the
-- catalogue is untouched and no product photo changes behaviour.
--
-- Profile photos are moved to `private` by the UPDATE below — the one owner type
-- that is somebody's face rather than something for sale.
--
-- WHY A COLUMN AND NOT "INFER IT FROM owner_type".
--
-- Because the rule would then live in code that has to be kept in step with a
-- vocabulary that has already changed once (migration 0014 dropped the
-- owner_type CHECK). A column can be read, indexed, and corrected by an operator
-- without a deploy, and a new owner type defaults to public rather than silently
-- inheriting a rule nobody remembered to extend.

ALTER TABLE media_assets
    ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'public' AFTER owner_id;

-- A face is not catalogue.
UPDATE media_assets SET visibility = 'private' WHERE owner_type = 'profile';

-- The media endpoint filters on it on every request.
ALTER TABLE media_assets
    ADD INDEX ix_media_assets_visibility (visibility);
