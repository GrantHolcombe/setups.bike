--
-- PostgreSQL database dump
--

\restrict E01vWfjF8Qj1MCKz63KCv7Wj60nfcjrbv2u7pBdfodgffLm4kbllJBlifY0kuro

-- Dumped from database version 18.7 (84da7d8)
-- Dumped by pg_dump version 18.6

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
-- Name: insert_garage_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_garage_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$begin
insert into Garage_order(app_user_id, bike_id, garage_order)
values(NEW.app_user_id, NEW.bike_id, (
	select 
	coalesce(max(garage_order), 0) + 1 as max
	from garage_order
	where app_user_id = NEW.app_user_id
	)
);
return NEW;
end$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bike; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bike (
    bike_id bigint NOT NULL,
    front_tire integer DEFAULT 0,
    front_sus_pressure integer DEFAULT 0,
    front_sus_comp_1 integer DEFAULT 0,
    front_sus_comp_2 integer DEFAULT 0,
    front_sus_comp_count integer DEFAULT 0,
    front_sus_rebound_1 integer DEFAULT 0,
    front_sus_rebound_2 integer DEFAULT 0,
    front_sus_rebound_count integer DEFAULT 0,
    front_tokens integer DEFAULT 0,
    rear_tire integer DEFAULT 0,
    rear_sus_pressure integer DEFAULT 0,
    rear_sus_comp_1 integer DEFAULT 0,
    rear_sus_comp_2 integer DEFAULT 0,
    rear_sus_comp_count integer DEFAULT 0,
    rear_sus_rebound_1 integer DEFAULT 0,
    rear_sus_rebound_2 integer DEFAULT 0,
    rear_sus_rebound_count integer DEFAULT 0,
    rear_tokens integer DEFAULT 0,
    app_user_id bigint,
    brand character varying(255) NOT NULL,
    model character varying(255) NOT NULL,
    active_setup_id bigint,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.bike ALTER COLUMN active_setup_id SET (pg_attver=33243952);
ALTER TABLE ONLY public.bike ALTER COLUMN created_at SET (pg_attver=40123504);


--
-- Name: Bike_bike_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bike ALTER COLUMN bike_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public."Bike_bike_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    first_name character varying(255),
    last_name character varying(255),
    email_address character varying(255) NOT NULL,
    app_user_id bigint NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    plan_source text,
    plan_status text,
    plan_interval text,
    plan_renews_at timestamp with time zone,
    plan_cancel_at_period_end boolean DEFAULT false NOT NULL,
    plan_updated_at timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    created_at timestamp with time zone DEFAULT now(),
    last_active_at timestamp with time zone,
    signup_source text,
    signup_medium text,
    signup_campaign text,
    signup_ref text,
    marketing_emails boolean,
    marketing_emails_changed_at timestamp with time zone,
    marketing_emails_source text,
    CONSTRAINT app_user_marketing_emails_source_check CHECK (((marketing_emails_source IS NULL) OR (marketing_emails_source = ANY (ARRAY['existing_user'::text, 'prompt'::text, 'settings'::text, 'resend'::text, 'bounce'::text, 'complaint'::text])))),
    CONSTRAINT app_user_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text]))),
    CONSTRAINT app_user_plan_interval_check CHECK (((plan_interval IS NULL) OR (plan_interval = ANY (ARRAY['month'::text, 'year'::text])))),
    CONSTRAINT app_user_plan_source_check CHECK (((plan_source IS NULL) OR (plan_source = ANY (ARRAY['stripe'::text, 'apple'::text, 'google'::text, 'comp'::text])))),
    CONSTRAINT app_user_signup_source_len CHECK (((char_length(signup_source) <= 64) AND (char_length(signup_medium) <= 64) AND (char_length(signup_campaign) <= 64) AND (char_length(signup_ref) <= 64)))
);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan SET (pg_attver=31955024);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_source SET (pg_attver=31956416);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_status SET (pg_attver=31956864);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_interval SET (pg_attver=31957336);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_renews_at SET (pg_attver=31957792);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_cancel_at_period_end SET (pg_attver=31958392);
ALTER TABLE ONLY public.app_user ALTER COLUMN plan_updated_at SET (pg_attver=31959704);
ALTER TABLE ONLY public.app_user ALTER COLUMN stripe_customer_id SET (pg_attver=31960160);
ALTER TABLE ONLY public.app_user ALTER COLUMN stripe_subscription_id SET (pg_attver=31960616);
ALTER TABLE ONLY public.app_user ALTER COLUMN created_at SET (pg_attver=40121696);
ALTER TABLE ONLY public.app_user ALTER COLUMN last_active_at SET (pg_attver=40123000);
ALTER TABLE ONLY public.app_user ALTER COLUMN signup_source SET (pg_attver=40293608);
ALTER TABLE ONLY public.app_user ALTER COLUMN signup_medium SET (pg_attver=40294064);
ALTER TABLE ONLY public.app_user ALTER COLUMN signup_campaign SET (pg_attver=40294520);
ALTER TABLE ONLY public.app_user ALTER COLUMN signup_ref SET (pg_attver=40294976);
ALTER TABLE ONLY public.app_user ALTER COLUMN marketing_emails SET (pg_attver=43688696);
ALTER TABLE ONLY public.app_user ALTER COLUMN marketing_emails_changed_at SET (pg_attver=43689152);
ALTER TABLE ONLY public.app_user ALTER COLUMN marketing_emails_source SET (pg_attver=43689616);


--
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_user ALTER COLUMN app_user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_identity (
    auth_identity_id bigint NOT NULL,
    app_user_id bigint NOT NULL,
    provider text NOT NULL,
    provider_subject text,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT auth_identity_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'email'::text, 'apple'::text])))
);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN auth_identity_id SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN app_user_id SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN provider SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN provider_subject SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN email SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN created_at SET (pg_attver=44900432);
ALTER TABLE ONLY public.auth_identity ALTER COLUMN last_used_at SET (pg_attver=44900432);


--
-- Name: auth_identity_auth_identity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_identity ALTER COLUMN auth_identity_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auth_identity_auth_identity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bike_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bike_setup (
    bike_setup_id bigint NOT NULL,
    bike_id bigint NOT NULL,
    name character varying(40) NOT NULL,
    front_tire integer DEFAULT 0 NOT NULL,
    front_sus_pressure integer DEFAULT 0 NOT NULL,
    front_sus_comp_1 integer DEFAULT 0 NOT NULL,
    front_sus_comp_2 integer DEFAULT 0 NOT NULL,
    front_sus_comp_count integer DEFAULT 0 NOT NULL,
    front_sus_rebound_1 integer DEFAULT 0 NOT NULL,
    front_sus_rebound_2 integer DEFAULT 0 NOT NULL,
    front_sus_rebound_count integer DEFAULT 0 NOT NULL,
    front_tokens integer DEFAULT 0 NOT NULL,
    rear_tire integer DEFAULT 0 NOT NULL,
    rear_sus_pressure integer DEFAULT 0 NOT NULL,
    rear_sus_comp_1 integer DEFAULT 0 NOT NULL,
    rear_sus_comp_2 integer DEFAULT 0 NOT NULL,
    rear_sus_comp_count integer DEFAULT 0 NOT NULL,
    rear_sus_rebound_1 integer DEFAULT 0 NOT NULL,
    rear_sus_rebound_2 integer DEFAULT 0 NOT NULL,
    rear_sus_rebound_count integer DEFAULT 0 NOT NULL,
    rear_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bike_setup_name_check CHECK ((length(btrim((name)::text)) > 0))
);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN bike_setup_id SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN bike_id SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN name SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_tire SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_pressure SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_comp_1 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_comp_2 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_comp_count SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_rebound_1 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_rebound_2 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_sus_rebound_count SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN front_tokens SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_tire SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_pressure SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_comp_1 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_comp_2 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_comp_count SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_rebound_1 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_rebound_2 SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_sus_rebound_count SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN rear_tokens SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN created_at SET (pg_attver=33182648);
ALTER TABLE ONLY public.bike_setup ALTER COLUMN updated_at SET (pg_attver=33182648);


--
-- Name: bike_setup_bike_setup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bike_setup ALTER COLUMN bike_setup_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bike_setup_bike_setup_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_login_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_login_code (
    email_login_code_id bigint NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    request_ip text,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone
);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN email_login_code_id SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN email SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN code_hash SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN request_ip SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN attempts SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN created_at SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN expires_at SET (pg_attver=45300024);
ALTER TABLE ONLY public.email_login_code ALTER COLUMN consumed_at SET (pg_attver=45300024);


--
-- Name: email_login_code_email_login_code_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_login_code ALTER COLUMN email_login_code_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.email_login_code_email_login_code_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: garage_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garage_order (
    garage_order_id bigint NOT NULL,
    app_user_id bigint NOT NULL,
    garage_order bigint NOT NULL,
    bike_id bigint NOT NULL
);


--
-- Name: garage_order_garage_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.garage_order ALTER COLUMN garage_order_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.garage_order_garage_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: garage_order_garage_order_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.garage_order ALTER COLUMN garage_order ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.garage_order_garage_order_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ride_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_note (
    ride_note_id bigint NOT NULL,
    bike_id bigint NOT NULL,
    ride_date date DEFAULT CURRENT_DATE NOT NULL,
    trail character varying(80),
    conditions character varying(12),
    rating smallint,
    note character varying(2000),
    setup_name character varying(40),
    settings jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ride_note_conditions_check CHECK (((conditions)::text = ANY ((ARRAY['dry'::character varying, 'tacky'::character varying, 'wet'::character varying, 'muddy'::character varying, 'loose'::character varying, 'snow'::character varying])::text[]))),
    CONSTRAINT ride_note_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
ALTER TABLE ONLY public.ride_note ALTER COLUMN ride_note_id SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN bike_id SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN ride_date SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN trail SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN conditions SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN rating SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN note SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN setup_name SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN settings SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN created_at SET (pg_attver=34155744);
ALTER TABLE ONLY public.ride_note ALTER COLUMN updated_at SET (pg_attver=34155744);


--
-- Name: ride_note_ride_note_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ride_note ALTER COLUMN ride_note_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ride_note_ride_note_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: shared_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_setup (
    share_id character varying(32) NOT NULL,
    app_user_id bigint NOT NULL,
    bike_id bigint NOT NULL,
    brand character varying(255) NOT NULL,
    model character varying(255) NOT NULL,
    setup_name character varying(40),
    settings jsonb NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    copies integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT shared_setup_share_id_check CHECK (((share_id)::text ~ '^[A-Za-z0-9_-]{16,32}$'::text))
);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN share_id SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN app_user_id SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN bike_id SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN brand SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN model SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN setup_name SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN settings SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN views SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN copies SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN created_at SET (pg_attver=34191336);
ALTER TABLE ONLY public.shared_setup ALTER COLUMN revoked_at SET (pg_attver=34191336);


--
-- Name: stripe_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_event (
    event_id text NOT NULL,
    event_type text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.stripe_event ALTER COLUMN event_id SET (pg_attver=31976832);
ALTER TABLE ONLY public.stripe_event ALTER COLUMN event_type SET (pg_attver=31976832);
ALTER TABLE ONLY public.stripe_event ALTER COLUMN received_at SET (pg_attver=31976832);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (app_user_id);


--
-- Name: app_user app_user_stripe_customer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_stripe_customer_unique UNIQUE (stripe_customer_id);


--
-- Name: app_user app_user_stripe_subscription_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_stripe_subscription_unique UNIQUE (stripe_subscription_id);


--
-- Name: auth_identity auth_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_identity
    ADD CONSTRAINT auth_identity_pkey PRIMARY KEY (auth_identity_id);


--
-- Name: bike bike_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bike
    ADD CONSTRAINT bike_pkey PRIMARY KEY (bike_id);


--
-- Name: bike_setup bike_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bike_setup
    ADD CONSTRAINT bike_setup_pkey PRIMARY KEY (bike_setup_id);


--
-- Name: email_login_code email_login_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_login_code
    ADD CONSTRAINT email_login_code_pkey PRIMARY KEY (email_login_code_id);


--
-- Name: app_user email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT email_unique UNIQUE (email_address);


--
-- Name: garage_order garage_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_order
    ADD CONSTRAINT garage_order_pkey PRIMARY KEY (garage_order_id);


--
-- Name: ride_note ride_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_note
    ADD CONSTRAINT ride_note_pkey PRIMARY KEY (ride_note_id);


--
-- Name: shared_setup shared_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_setup
    ADD CONSTRAINT shared_setup_pkey PRIMARY KEY (share_id);


--
-- Name: stripe_event stripe_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_event
    ADD CONSTRAINT stripe_event_pkey PRIMARY KEY (event_id);


--
-- Name: auth_identity_provider_subject_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_identity_provider_subject_key ON public.auth_identity USING btree (provider, provider_subject) WHERE (provider_subject IS NOT NULL);


--
-- Name: auth_identity_user_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_identity_user_provider_key ON public.auth_identity USING btree (app_user_id, provider);


--
-- Name: bike_setup_name_per_bike; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bike_setup_name_per_bike ON public.bike_setup USING btree (bike_id, lower(btrim((name)::text)));


--
-- Name: email_login_code_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_login_code_email_idx ON public.email_login_code USING btree (email, created_at DESC);


--
-- Name: email_login_code_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_login_code_ip_idx ON public.email_login_code USING btree (request_ip, created_at);


--
-- Name: ride_note_by_bike; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_note_by_bike ON public.ride_note USING btree (bike_id, ride_date DESC, ride_note_id DESC);


--
-- Name: shared_setup_by_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shared_setup_by_owner ON public.shared_setup USING btree (app_user_id, created_at DESC);


--
-- Name: bike insert_garage_order_after_add_bike; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER insert_garage_order_after_add_bike AFTER INSERT ON public.bike FOR EACH ROW EXECUTE FUNCTION public.insert_garage_order();


--
-- Name: auth_identity auth_identity_app_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_identity
    ADD CONSTRAINT auth_identity_app_user_id_fkey FOREIGN KEY (app_user_id) REFERENCES public.app_user(app_user_id) ON DELETE CASCADE;


--
-- Name: bike bike_active_setup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bike
    ADD CONSTRAINT bike_active_setup_id_fkey FOREIGN KEY (active_setup_id) REFERENCES public.bike_setup(bike_setup_id) ON DELETE SET NULL;


--
-- Name: bike_setup bike_setup_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bike_setup
    ADD CONSTRAINT bike_setup_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bike(bike_id) ON DELETE CASCADE;


--
-- Name: bike fk_bike_app_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bike
    ADD CONSTRAINT fk_bike_app_user_id FOREIGN KEY (app_user_id) REFERENCES public.app_user(app_user_id);


--
-- Name: garage_order fk_garage_order_bike; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_order
    ADD CONSTRAINT fk_garage_order_bike FOREIGN KEY (bike_id) REFERENCES public.bike(bike_id) ON DELETE CASCADE;


--
-- Name: garage_order fk_user_garage_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garage_order
    ADD CONSTRAINT fk_user_garage_order FOREIGN KEY (app_user_id) REFERENCES public.app_user(app_user_id);


--
-- Name: ride_note ride_note_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_note
    ADD CONSTRAINT ride_note_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bike(bike_id) ON DELETE CASCADE;


--
-- Name: shared_setup shared_setup_app_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_setup
    ADD CONSTRAINT shared_setup_app_user_id_fkey FOREIGN KEY (app_user_id) REFERENCES public.app_user(app_user_id) ON DELETE CASCADE;


--
-- Name: shared_setup shared_setup_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_setup
    ADD CONSTRAINT shared_setup_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bike(bike_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict E01vWfjF8Qj1MCKz63KCv7Wj60nfcjrbv2u7pBdfodgffLm4kbllJBlifY0kuro

