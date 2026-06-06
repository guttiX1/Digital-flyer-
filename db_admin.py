#!/usr/bin/env python3
"""
db_admin.py — Database administration tool for the Flyer Pipeline

Commands:
    python db_admin.py events                       List all events
    python db_admin.py races <event_id>             Show races for an event
    python db_admin.py fans [--event <id>]          Show fan sign-ups
    python db_admin.py picks [--event <id>]         Show fan picks
    python db_admin.py export-contacts [--event <id>] [--out contacts.csv]
    python db_admin.py pick6 [--event <id>]         Show Pick 6 cards
    python db_admin.py mark-winner <card_number>    Mark a Pick 6 card as winner
    python db_admin.py outputs [--event <id>]       Show generated output files

Options:
    --db <path>     SQLite database (default: output/racing.db)
"""

import sys
import csv
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime


DEFAULT_DB = Path("output/racing.db")


def open_db(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        print(f"Error: database not found at {db_path}", file=sys.stderr)
        print("Run outreach.py first to create it.", file=sys.stderr)
        sys.exit(1)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def fmt_row(row: sqlite3.Row) -> dict:
    return dict(row)


def print_table(rows: list, cols: list):
    if not rows:
        print("  (no records)\n")
        return
    widths = {c: len(c) for c in cols}
    for row in rows:
        for c in cols:
            widths[c] = max(widths[c], len(str(row.get(c, "") or "")))
    sep = "  ".join("-" * widths[c] for c in cols)
    header = "  ".join(c.upper().ljust(widths[c]) for c in cols)
    print(f"\n  {header}")
    print(f"  {sep}")
    for row in rows:
        line = "  ".join(str(row.get(c, "") or "").ljust(widths[c]) for c in cols)
        print(f"  {line}")
    print()


# ── commands ──────────────────────────────────────────────────────────────────

def cmd_events(conn, args):
    rows = conn.execute(
        "SELECT id, name, date, venue, location, extracted_at FROM events ORDER BY id DESC"
    ).fetchall()
    print(f"\n{'='*50}")
    print("  EVENTS")
    print(f"{'='*50}")
    print_table([fmt_row(r) for r in rows],
                ["id", "name", "date", "venue", "location", "extracted_at"])
    print(f"  Total: {len(rows)} event(s)\n")


def cmd_races(conn, args):
    import json
    event_id = args.event_id
    event = conn.execute("SELECT name, date FROM events WHERE id=?", (event_id,)).fetchone()
    if not event:
        print(f"Error: event {event_id} not found.", file=sys.stderr)
        sys.exit(1)
    print(f"\n{'='*50}")
    print(f"  RACES — Event {event_id}: {event['name']} ({event['date']})")
    print(f"{'='*50}")
    races = conn.execute(
        "SELECT id, race_number, race_name, distance, surface, purse, horses "
        "FROM races WHERE event_id=? ORDER BY race_number",
        (event_id,)
    ).fetchall()
    for race in races:
        horses = json.loads(race["horses"] or "[]")
        print(f"\n  Race {race['race_number']}: {race['race_name'] or '(unnamed)'}")
        if race["distance"]:
            print(f"    Distance : {race['distance']}")
        if race["surface"]:
            print(f"    Surface  : {race['surface']}")
        if race["purse"]:
            print(f"    Purse    : {race['purse']}")
        if horses:
            print(f"    Horses   :")
            for h in horses:
                parts = [f"    {h.get('number', '?'):>3}. {h.get('name', '')}"]
                if h.get("jockey"):
                    parts.append(f"(J: {h['jockey']})")
                if h.get("odds"):
                    parts.append(f"[{h['odds']}]")
                print("  ".join(parts))
    print()


def cmd_fans(conn, args):
    q = "SELECT id, name, email, phone, source, created_at FROM fans"
    params = []
    if args.event:
        # fans who made picks for this event
        q = (
            "SELECT DISTINCT f.id, f.name, f.email, f.phone, f.source, f.created_at "
            "FROM fans f JOIN picks p ON f.id=p.fan_id WHERE p.event_id=?"
        )
        params = [args.event]
    q += " ORDER BY id DESC"
    rows = conn.execute(q, params).fetchall()
    print(f"\n{'='*50}")
    print("  FANS")
    print(f"{'='*50}")
    print_table([fmt_row(r) for r in rows],
                ["id", "name", "email", "phone", "source", "created_at"])
    print(f"  Total: {len(rows)} fan(s)\n")


def cmd_picks(conn, args):
    q = (
        "SELECT p.id, f.name, e.name as event, r.race_number, p.horse_name, p.created_at "
        "FROM picks p "
        "JOIN fans f ON f.id=p.fan_id "
        "JOIN events e ON e.id=p.event_id "
        "JOIN races r ON r.id=p.race_id"
    )
    params = []
    if args.event:
        q += " WHERE p.event_id=?"
        params = [args.event]
    q += " ORDER BY p.id DESC"
    rows = conn.execute(q, params).fetchall()
    print(f"\n{'='*50}")
    print("  PICKS")
    print(f"{'='*50}")
    print_table([fmt_row(r) for r in rows],
                ["id", "name", "event", "race_number", "horse_name", "created_at"])
    print(f"  Total: {len(rows)} pick(s)\n")


def cmd_export_contacts(conn, args):
    q = "SELECT name, email, phone, source, created_at FROM fans"
    params = []
    if args.event:
        q = (
            "SELECT DISTINCT f.name, f.email, f.phone, f.source, f.created_at "
            "FROM fans f JOIN picks p ON f.id=p.fan_id WHERE p.event_id=?"
        )
        params = [args.event]
    q += " ORDER BY f.created_at DESC" if "JOIN" in q else " ORDER BY created_at DESC"
    rows = conn.execute(q, params).fetchall()

    out_path = Path(args.out) if args.out else Path("output/contacts.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "email", "phone", "source", "created_at"])
        for row in rows:
            writer.writerow([row["name"], row["email"] or "", row["phone"] or "",
                             row["source"] or "", row["created_at"] or ""])

    print(f"\n  ✓ Exported {len(rows)} contact(s) to {out_path}\n")


def cmd_pick6(conn, args):
    import json
    q = (
        "SELECT c.id, c.card_number, e.name as event, f.name as fan, "
        "c.picks, c.is_winner, c.created_at "
        "FROM pick6_cards c "
        "LEFT JOIN events e ON e.id=c.event_id "
        "LEFT JOIN fans f ON f.id=c.fan_id"
    )
    params = []
    if args.event:
        q += " WHERE c.event_id=?"
        params = [args.event]
    q += " ORDER BY c.id DESC"
    rows = conn.execute(q, params).fetchall()

    print(f"\n{'='*60}")
    print("  PICK 6 CARDS")
    print(f"{'='*60}")
    for row in rows:
        winner_tag = " ★ WINNER" if row["is_winner"] else ""
        print(f"\n  Card #{row['card_number']}{winner_tag}")
        print(f"    Event   : {row['event'] or 'N/A'}")
        print(f"    Fan     : {row['fan'] or 'anonymous'}")
        print(f"    Created : {row['created_at']}")
        picks = json.loads(row["picks"] or "{}")
        if picks:
            print(f"    Picks   :")
            for race_num, horse in sorted(picks.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0):
                print(f"      Race {race_num}: {horse}")

    print(f"\n  Total: {len(rows)} card(s)\n")


def cmd_mark_winner(conn, args):
    card_num = args.card_number
    row = conn.execute(
        "SELECT id, card_number FROM pick6_cards WHERE card_number=?", (card_num,)
    ).fetchone()
    if not row:
        print(f"Error: card '{card_num}' not found.", file=sys.stderr)
        sys.exit(1)
    conn.execute(
        "UPDATE pick6_cards SET is_winner=1 WHERE card_number=?", (card_num,)
    )
    conn.commit()
    print(f"\n  ✓ Card #{card_num} marked as WINNER\n")


def cmd_outputs(conn, args):
    q = (
        "SELECT o.id, e.name as event, o.output_type, o.file_path, o.created_at "
        "FROM outreach_log o LEFT JOIN events e ON e.id=o.event_id"
    )
    params = []
    if args.event:
        q += " WHERE o.event_id=?"
        params = [args.event]
    q += " ORDER BY o.id DESC"
    rows = conn.execute(q, params).fetchall()
    print(f"\n{'='*50}")
    print("  GENERATED OUTPUTS")
    print(f"{'='*50}")
    print_table([fmt_row(r) for r in rows],
                ["id", "event", "output_type", "file_path", "created_at"])
    print(f"  Total: {len(rows)} output(s)\n")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="db_admin.py — Flyer Pipeline database tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("events", help="List all events")

    p_races = sub.add_parser("races", help="Show races for an event")
    p_races.add_argument("event_id", type=int)

    p_fans = sub.add_parser("fans", help="Show fan sign-ups")
    p_fans.add_argument("--event", type=int, metavar="EVENT_ID")

    p_picks = sub.add_parser("picks", help="Show fan picks")
    p_picks.add_argument("--event", type=int, metavar="EVENT_ID")

    p_export = sub.add_parser("export-contacts", help="Export fan contacts to CSV")
    p_export.add_argument("--event", type=int, metavar="EVENT_ID")
    p_export.add_argument("--out", metavar="FILE", help="Output CSV path (default: output/contacts.csv)")

    p_pick6 = sub.add_parser("pick6", help="Show Pick 6 cards")
    p_pick6.add_argument("--event", type=int, metavar="EVENT_ID")

    p_winner = sub.add_parser("mark-winner", help="Mark a Pick 6 card as winner")
    p_winner.add_argument("card_number")

    p_out = sub.add_parser("outputs", help="Show generated output files")
    p_out.add_argument("--event", type=int, metavar="EVENT_ID")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    conn = open_db(Path(args.db))

    dispatch = {
        "events":          cmd_events,
        "races":           cmd_races,
        "fans":            cmd_fans,
        "picks":           cmd_picks,
        "export-contacts": cmd_export_contacts,
        "pick6":           cmd_pick6,
        "mark-winner":     cmd_mark_winner,
        "outputs":         cmd_outputs,
    }

    fn = dispatch.get(args.command)
    if fn:
        fn(conn, args)
    else:
        parser.print_help()

    conn.close()


if __name__ == "__main__":
    main()
