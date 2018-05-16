# Database tables for Iwatched.xyz

## User table (tb_users)
 - user_id      - int           - Auto Increment, Index
 - user_name    - varchar(50)   - Unique
 - user_pass    - varchar(50)   - Must be encrypted
 - fk_user_info - int           - Info table Relation


user = {
    _id         : "",
    username    : "",
    password    : "",
    email       : "",
    profile     : {
                    cover_image     : "",
                    profile_image   : "",
                    description     : "",
                    birtday         : "",
                    gender          : ""
    },
    watched_movies : [
        "id",
        "id"
    ],
    watched_series : [
        "id",
        "id"
    ],
    saved_movies : [
        "id",
        "id"
    ]
    saved_series : [
        "id",
        "id"
    ]
}

## User Info table (tb_user_info)
 - info_id      - int           - Auto Increment
 - info_email   - varchar(255)  -
 - info_pImage  - varchar(255)  -
 - info_text    - text          -

## User Watched Movies Table (tb_watched_movies) ('tmd' stands for The Movie Database)
 - movie_id     - int   - Auto Increment, Index
 - movie_tmd_id - int   - Movie id from TMD
 - fk_user_id   - int   - ID from tb_users

## User Watched Shows Table (tb_watched_shows) ('tmd' stands for The Movie Database)
 - show_id      - int   - Auto Increment, Index
 - show_tmd_id  - int   - Show id from TMD
 - fk_user_id   - int   - ID from tb_users