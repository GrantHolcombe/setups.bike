--
-- PostgreSQL database dump
--

\restrict FA2UTEv7teOnbreemZS69h4pt4HtLJnO77w4l7aIaViWaYx9tVK5bUynd5OPolu

-- Dumped from database version 18.7 (a21afb5)
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
    active_setup_id bigint
);
ALTER TABLE ONLY public.bike ALTER COLUMN active_setup_id SET (pg_attver=33243952);


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
    CONSTRAINT app_user_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text]))),
    CONSTRAINT app_user_plan_interval_check CHECK (((plan_interval IS NULL) OR (plan_interval = ANY (ARRAY['month'::text, 'year'::text])))),
    CONSTRAINT app_user_plan_source_check CHECK (((plan_source IS NULL) OR (plan_source = ANY (ARRAY['stripe'::text, 'apple'::text, 'google'::text]))))
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
-- Name: stripe_event stripe_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_event
    ADD CONSTRAINT stripe_event_pkey PRIMARY KEY (event_id);


--
-- Name: bike_setup_name_per_bike; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bike_setup_name_per_bike ON public.bike_setup USING btree (bike_id, lower(btrim((name)::text)));


--
-- Name: bike insert_garage_order_after_add_bike; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER insert_garage_order_after_add_bike AFTER INSERT ON public.bike FOR EACH ROW EXECUTE FUNCTION public.insert_garage_order();


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
    ADD CONSTRAINT fk_bike_app_user_id FOREIGN KEY (app_user_id) REFERENCES public.app_user(app_user_id) NOT VALID;


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
-- PostgreSQL database dump complete
--

\unrestrict FA2UTEv7teOnbreemZS69h4pt4HtLJnO77w4l7aIaViWaYx9tVK5bUynd5OPolu

