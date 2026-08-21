\restrict DZgOqvoxRfBNZKBBZIcBnRo9aGDEj1WhcygwOrmpb97eCVdp7eOKd49qwSYAu2T

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
-- Name: citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    type public.citation_type DEFAULT 'other'::public.citation_type NOT NULL,
    title text,
    author text,
    published_at timestamp with time zone,
    summary text,
    archive_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_comment_id uuid,
    body text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issue_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_citations (
    issue_id uuid NOT NULL,
    citation_id uuid NOT NULL
);


--
-- Name: issue_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_id uuid NOT NULL,
    s2_cell_id bigint NOT NULL,
    region_name text
);


--
-- Name: issue_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    relation_type public.relation_type NOT NULL,
    body text
);


--
-- Name: issue_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_tags (
    issue_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: issue_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body text,
    image_path text,
    edited_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text,
    image_path text,
    type public.issue_type DEFAULT 'draft'::public.issue_type NOT NULL,
    status public.issue_status DEFAULT 'open'::public.issue_status NOT NULL,
    severity smallint,
    score integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT issues_severity_check CHECK (((severity >= 1) AND (severity <= 5)))
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
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_tag_id uuid,
    description text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text,
    oidc_sub text,
    oidc_issuer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.votes (
    user_id uuid NOT NULL,
    target_type public.vote_target_type NOT NULL,
    target_id uuid NOT NULL,
    value smallint NOT NULL,
    CONSTRAINT votes_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: captcha_challenges captcha_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captcha_challenges
    ADD CONSTRAINT captcha_challenges_pkey PRIMARY KEY (id);


--
-- Name: citations citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_pkey PRIMARY KEY (id);


--
-- Name: citations citations_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_url_key UNIQUE (url);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: issue_citations issue_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_citations
    ADD CONSTRAINT issue_citations_pkey PRIMARY KEY (issue_id, citation_id);


--
-- Name: issue_regions issue_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_regions
    ADD CONSTRAINT issue_regions_pkey PRIMARY KEY (id);


--
-- Name: issue_relations issue_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_relations
    ADD CONSTRAINT issue_relations_pkey PRIMARY KEY (id);


--
-- Name: issue_relations issue_relations_source_id_target_id_relation_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_relations
    ADD CONSTRAINT issue_relations_source_id_target_id_relation_type_key UNIQUE (source_id, target_id, relation_type);


--
-- Name: issue_tags issue_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_tags
    ADD CONSTRAINT issue_tags_pkey PRIMARY KEY (issue_id, tag_id);


--
-- Name: issue_versions issue_versions_issue_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_versions
    ADD CONSTRAINT issue_versions_issue_id_version_key UNIQUE (issue_id, version);


--
-- Name: issue_versions issue_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_versions
    ADD CONSTRAINT issue_versions_pkey PRIMARY KEY (id);


--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_pkey PRIMARY KEY (id);


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
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


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
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (user_id, target_type, target_id);


--
-- Name: idx_comments_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_issue ON public.comments USING btree (issue_id);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_parent ON public.comments USING btree (parent_comment_id);


--
-- Name: idx_comments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_user ON public.comments USING btree (user_id);


--
-- Name: idx_issue_regions_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_regions_issue ON public.issue_regions USING btree (issue_id);


--
-- Name: idx_issue_regions_s2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_regions_s2 ON public.issue_regions USING btree (s2_cell_id);


--
-- Name: idx_issue_versions_issue_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_versions_issue_id ON public.issue_versions USING btree (issue_id);


--
-- Name: idx_issues_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_created_at ON public.issues USING btree (created_at DESC);


--
-- Name: idx_issues_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_created_by ON public.issues USING btree (created_by);


--
-- Name: idx_issues_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_score ON public.issues USING btree (score DESC);


--
-- Name: idx_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_status ON public.issues USING btree (status);


--
-- Name: idx_issues_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_type ON public.issues USING btree (type);


--
-- Name: idx_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_source ON public.issue_relations USING btree (source_id);


--
-- Name: idx_relations_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_target ON public.issue_relations USING btree (target_id);


--
-- Name: idx_sessions_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token_hash ON public.sessions USING btree (token_hash);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_tags_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_parent ON public.tags USING btree (parent_tag_id);


--
-- Name: comments comments_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: issue_citations issue_citations_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_citations
    ADD CONSTRAINT issue_citations_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.citations(id) ON DELETE CASCADE;


--
-- Name: issue_citations issue_citations_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_citations
    ADD CONSTRAINT issue_citations_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_regions issue_regions_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_regions
    ADD CONSTRAINT issue_regions_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_relations issue_relations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_relations
    ADD CONSTRAINT issue_relations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_relations issue_relations_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_relations
    ADD CONSTRAINT issue_relations_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_tags issue_tags_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_tags
    ADD CONSTRAINT issue_tags_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_tags issue_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_tags
    ADD CONSTRAINT issue_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: issue_versions issue_versions_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_versions
    ADD CONSTRAINT issue_versions_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id);


--
-- Name: issue_versions issue_versions_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_versions
    ADD CONSTRAINT issue_versions_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issues issues_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tags tags_parent_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_parent_tag_id_fkey FOREIGN KEY (parent_tag_id) REFERENCES public.tags(id) ON DELETE SET NULL;


--
-- Name: votes votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DZgOqvoxRfBNZKBBZIcBnRo9aGDEj1WhcygwOrmpb97eCVdp7eOKd49qwSYAu2T


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('001'),
    ('002'),
    ('003'),
    ('004'),
    ('005'),
    ('006'),
    ('007'),
    ('008'),
    ('009'),
    ('010'),
    ('011'),
    ('012'),
    ('013'),
    ('014');
