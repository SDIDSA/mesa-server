CREATE FUNCTION public.generate_confirmation_code(length integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
	res text := '';
	i integer := 0;

begin
    LOOP
		EXIT WHEN i = length ;
        res := CONCAT(res, random_int(0,9));
        i := i + 1;
    END LOOP;

    RETURN res;
END
$$;

CREATE FUNCTION public.on_register() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	INSERT INTO public.email_confirm(user_id, code) values (NEW.id, generate_confirmation_code(8));
	RETURN NEW;
END
$$;

CREATE FUNCTION public.random_int(min integer, max integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
   RETURN floor(random()* (max-min + 1) + min);
END;
$$;

CREATE TABLE public.channel (
    id integer NOT NULL,
    "group" integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL
);

CREATE SEQUENCE public.audio_channel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.audio_channel_id_seq OWNED BY public.channel.id;

CREATE TABLE public.channel_group (
    id integer NOT NULL,
    server integer NOT NULL,
    name text NOT NULL
);

CREATE SEQUENCE public.channel_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.channel_category_id_seq OWNED BY public.channel_group.id;

CREATE TABLE public.email_confirm (
    user_id text NOT NULL,
    code text NOT NULL
);

CREATE TABLE public.invite (
    id text NOT NULL,
    server integer NOT NULL
);

CREATE TABLE public.member (
    "user" text NOT NULL,
    server integer NOT NULL,
    "order" integer NOT NULL
);

CREATE SEQUENCE public.member_order_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.member_order_seq OWNED BY public.member."order";

CREATE TABLE public.message (
    id integer NOT NULL,
    sender text NOT NULL,
    channel integer NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    "time" text NOT NULL
);

CREATE SEQUENCE public.message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.message_id_seq OWNED BY public.message.id;

CREATE TABLE public.phone_confirm (
    user_id text NOT NULL,
    code text NOT NULL,
    phone text NOT NULL
);

CREATE TABLE public.server (
    id integer NOT NULL,
    owner text NOT NULL,
    name text NOT NULL,
    icon text NOT NULL
);

CREATE SEQUENCE public.server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.server_id_seq OWNED BY public.server.id;

CREATE TABLE public.session (
    user_id text NOT NULL,
    token text NOT NULL,
    client text,
    location text
);

CREATE TABLE public."user" (
    id text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    phone text,
    avatar text NOT NULL,
    birth_date text NOT NULL
);

ALTER TABLE ONLY public.channel ALTER COLUMN id SET DEFAULT nextval('public.audio_channel_id_seq'::regclass);

ALTER TABLE ONLY public.channel_group ALTER COLUMN id SET DEFAULT nextval('public.channel_category_id_seq'::regclass);

ALTER TABLE ONLY public.member ALTER COLUMN "order" SET DEFAULT nextval('public.member_order_seq'::regclass);

ALTER TABLE ONLY public.message ALTER COLUMN id SET DEFAULT nextval('public.message_id_seq'::regclass);

ALTER TABLE ONLY public.server ALTER COLUMN id SET DEFAULT nextval('public.server_id_seq'::regclass);

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT audio_channel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.channel_group
    ADD CONSTRAINT channel_category_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT email_un UNIQUE (email);

ALTER TABLE ONLY public.email_confirm
    ADD CONSTRAINT id PRIMARY KEY (user_id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT id_un UNIQUE (id);

ALTER TABLE ONLY public.invite
    ADD CONSTRAINT invite_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY ("user", server);

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.phone_confirm
    ADD CONSTRAINT phone_confirm_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT phone_un UNIQUE (phone);

ALTER TABLE ONLY public.server
    ADD CONSTRAINT server_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (user_id, token);

ALTER TABLE ONLY public.email_confirm
    ADD CONSTRAINT user_id_un UNIQUE (user_id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX user_id_index ON public."user" USING btree (id);

CREATE TRIGGER on_insert AFTER INSERT ON public."user" FOR EACH ROW EXECUTE FUNCTION public.on_register();

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_group_audio FOREIGN KEY ("group") REFERENCES public.channel_group(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.message
    ADD CONSTRAINT channel_message_fk FOREIGN KEY (channel) REFERENCES public.channel(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.invite
    ADD CONSTRAINT invite_server_fk FOREIGN KEY (server) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_server FOREIGN KEY (server) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_user FOREIGN KEY ("user") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.server
    ADD CONSTRAINT owner_id FOREIGN KEY (owner) REFERENCES public."user"(id);

ALTER TABLE ONLY public.message
    ADD CONSTRAINT sender_fk FOREIGN KEY (sender) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.channel_group
    ADD CONSTRAINT server_channel_group FOREIGN KEY (server) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.email_confirm
    ADD CONSTRAINT user_id FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.phone_confirm
    ADD CONSTRAINT user_phone_code FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.session
    ADD CONSTRAINT user_session_id FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;