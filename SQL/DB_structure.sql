CREATE SEQUENCE public.task_id_seq;
CREATE SEQUENCE public.to_do_list_id_seq;
CREATE SEQUENCE public.user_id_seq;
CREATE SEQUENCE public.user_session_id_seq;

CREATE TYPE public.activity_indicator AS ENUM
    ('active', 'inactive');

CREATE TABLE public."user"
(
    id integer NOT NULL DEFAULT nextval('user_id_seq'::regclass),
    name character varying(256) COLLATE pg_catalog."default" NOT NULL,
    password character varying(256) COLLATE pg_catalog."default" NOT NULL,
    created timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activity activity_indicator NOT NULL DEFAULT 'active'::activity_indicator,
    CONSTRAINT user_pkey PRIMARY KEY (id),
    CONSTRAINT uniq_username UNIQUE (name)
);

CREATE TABLE public.user_session
(
    id integer NOT NULL DEFAULT nextval('user_session_id_seq'::regclass),
    user_id integer NOT NULL,
    session_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    created timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp(6) with time zone NOT NULL,
    activity activity_indicator NOT NULL DEFAULT 'active'::activity_indicator,
    CONSTRAINT user_session_pkey PRIMARY KEY (id),
    CONSTRAINT session_to_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX user_id_session_id_usersession_index
    ON public.user_session USING btree
    (user_id ASC NULLS LAST, session_id COLLATE pg_catalog."default" ASC NULLS LAST);

CREATE TABLE public.to_do_list
(
    id integer NOT NULL DEFAULT nextval('to_do_list_id_seq'::regclass),
    user_id integer NOT NULL,
    name character varying(512) COLLATE pg_catalog."default" NOT NULL,
    created timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    priority integer NOT NULL,
    CONSTRAINT to_do_list_pkey PRIMARY KEY (id),
    CONSTRAINT todolist_to_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX user_id_totolist_index
    ON public.to_do_list USING btree
    (user_id ASC NULLS LAST);

CREATE TABLE public.task
(
    id integer NOT NULL DEFAULT nextval('task_id_seq'::regclass),
    to_do_list_id integer NOT NULL,
    user_id integer NOT NULL,
    content text COLLATE pg_catalog."default" NOT NULL,
    created timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    do_before timestamp(6) with time zone,
    priority integer NOT NULL,
    done boolean NOT NULL DEFAULT false,
    CONSTRAINT task_pkey PRIMARY KEY (id),
    CONSTRAINT task_to_todolist FOREIGN KEY (to_do_list_id)
        REFERENCES public.to_do_list (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT task_to_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX todolist_id_user_id_task_index
    ON public.task USING btree
    (to_do_list_id ASC NULLS LAST, user_id ASC NULLS LAST);
