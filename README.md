# POS System

## Environment setup

`backend/.env` is the single source of truth for all environment config, including
Docker Compose's own variables (`DATABASE_NAME`/`USER`/`PASSWORD`).
The root `.env` that Compose auto-loads is a symlink to it.

```bash
cp backend/.env.example backend/.env
# fill in the values, then:
ln -sf backend/.env .env
```

## Branch workflow

This repository uses main as the full project and separate worktrees for backend, frontend, and mobile.

### Main workflow

1. Work on main
2. Commit and push changes to main
3. Sync the area-specific worktrees from main

### Run the sync script

```bash
cd /home/hein-htet-nyan/Desktop/POS_system
./sync_branches.sh
```

### Worktrees

- Backend: /home/hein-htet-nyan/Desktop/POS_system_backend
- Frontend: /home/hein-htet-nyan/Desktop/POS_system_frontend
- Mobile: /home/hein-htet-nyan/Desktop/POS_system_mobile

### Useful commands

```bash
cd /home/hein-htet-nyan/Desktop/POS_system
git checkout main
git push origin main
```

```bash
cd /home/hein-htet-nyan/Desktop/POS_system_backend
git checkout backend
git push origin backend
```

```bash
cd /home/hein-htet-nyan/Desktop/POS_system_frontend
git checkout frontend
git push origin frontend
```

```bash
cd /home/hein-htet-nyan/Desktop/POS_system_mobile
git checkout mobile
git push origin mobile
```
