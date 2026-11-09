-- A chat whose contact form joined an existing lead it didn't start (unverified phone or email match).
ALTER TABLE "chat_conversations" ADD COLUMN "lead_joined" BOOLEAN NOT NULL DEFAULT false;
