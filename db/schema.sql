\restrict stUCuyOMHDod1gQZg7DnV1oikeD2cl9X3Nip8ErSSugR08zeOfCH7x7mMANKijj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.citation_type AS ENUM (
    'video',
    'article',
    'news',
    'location',
    'other'
);


--
-- Name: issue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.issue_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'wontfix'
);


--
-- Name: issue_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.issue_type AS ENUM (
    'draft',
    'problem',
    'cause',
    'action'
);


--
-- Name: relation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.relation_type AS ENUM (
    'causes',
    'parent_of',
    'related_to'
);


--
-- Name: vote_target_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vote_target_type AS ENUM (
    'issue',
    'issue_version',
    'comment'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: captcha_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captcha_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_data jsonb NOT NULL,
    answer_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: capture_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capture_id uuid NOT NULL,
    path text NOT NULL,
    caption text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: capture_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_regions (
    capture_id uuid NOT NULL,
    s2_cell bigint NOT NULL,
    label text
);


--
-- Name: capture_urls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_urls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capture_id uuid NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: captures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    status text DEFAULT '***'::text NOT NULL,
    what_text text,
    where_text text,
    why_text text,
    when_text text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text,
    display_name text,
    about text,
    avatar_path text,
    oidc_sub text,
    oidc_issuer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: captcha_challenges captcha_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captcha_challenges
    ADD CONSTRAINT captcha_challenges_pkey PRIMARY KEY (id);


--
-- Name: capture_images capture_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_images
    ADD CONSTRAINT capture_images_pkey PRIMARY KEY (id);


--
-- Name: capture_urls capture_urls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_urls
    ADD CONSTRAINT capture_urls_pkey PRIMARY KEY (id);


--
-- Name: captures captures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_capture_images_capture_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capture_images_capture_id ON public.capture_images USING btree (capture_id);


--
-- Name: idx_capture_regions_capture_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capture_regions_capture_id ON public.capture_regions USING btree (capture_id);


--
-- Name: idx_capture_regions_s2_cell; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capture_regions_s2_cell ON public.capture_regions USING btree (s2_cell);


--
-- Name: idx_capture_urls_capture_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capture_urls_capture_id ON public.capture_urls USING btree (capture_id);


--
-- Name: idx_captures_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_created_at ON public.captures USING btree (created_at DESC);


--
-- Name: idx_captures_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_status ON public.captures USING btree (status);


--
-- Name: idx_captures_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_user_id ON public.captures USING btree (user_id);


--
-- Name: idx_sessions_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token_hash ON public.sessions USING btree (token_hash);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: capture_images capture_images_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_images
    ADD CONSTRAINT capture_images_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.captures(id) ON DELETE CASCADE;


--
-- Name: capture_regions capture_regions_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_regions
    ADD CONSTRAINT capture_regions_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.captures(id) ON DELETE CASCADE;


--
-- Name: capture_urls capture_urls_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_urls
    ADD CONSTRAINT capture_urls_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.captures(id) ON DELETE CASCADE;


--
-- Name: captures captures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict stUCuyOMHDod1gQZg7DnV1oikeD2cl9X3Nip8ErSSugR08zeOfCH7x7mMANKijj


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('001'),
    ('002'),
    ('003'),
    ('004');
