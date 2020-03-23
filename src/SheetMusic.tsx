// @ts-nocheck
import React from 'react';
import abcjs from 'abcjs';

type Props = {
  isPlaying?: boolean;
  /** In ABC notation format */
  notation?: string;
  bpm?: number;
  scale?: number;
  className?: string;
  onBeat?: Function;
  onEvent?: Function;
  onLineEnd?: Function;
};

const SheetMusic: React.FunctionComponent<Props> = ({
  isPlaying,
  notation,
  bpm,
  scale = 1,
  className,
  onBeat,
  onEvent,
  onLineEnd,
}) => {
  // const paper = React.useRef();
  const timer = React.useRef<{
    start: Function;
    stop: Function;
  }>();

  const computeNoteAndOctave = n => {
    // Note number n is an integer 0 = C, 1 = D, ... 6 = B
    const noteLetters = {};
    noteLetters[0] = 'C';
    noteLetters[1] = 'D';
    noteLetters[2] = 'E';
    noteLetters[3] = 'F';
    noteLetters[4] = 'G';
    noteLetters[5] = 'A';
    noteLetters[6] = 'B';
    // And 7 is C on the next octave up. Note integers can be negative.
    // This cases a problem when using modulo - so add a large multiple
    // of 7 to avoid negatives.
    const note = noteLetters[(n + 700) % 7];
    // The + 2 here makes sure note 0 is in the correct octave
    const octave = Math.floor(n / 7) + 2;
    const out = { note, octave };
    return out;
  };

  const parseJSON = json => {
    let line: any;
    let staff: any;

    const data = json[0]; // this assumes there is only one song.
    const beatsPerBar = data.lines[0].staff[0].meter.value[0].num;
    const notes = {};
    let tripletMultiplier = 1;
    const lines = Object.values(data.lines);
    for (line of lines) {
      let staffNum = 0;
      const staves = Object.values(line.staff);
      for (staff of staves) {
        const voices = staff.voices[0];
        for (const note of voices) {
          if (note.startTriplet) {
            tripletMultiplier = note.tripletMultiplier;
          }
          if (note.pitches && note.el_type === 'note') {
            const duration =
              note.duration * tripletMultiplier * (60 / bpm) * beatsPerBar;
            const index = `s${note.startChar}e${note.endChar}`;
            const reactronicaNotes = [];
            for (const pitch of note.pitches) {
              let accidental = '';
              if (pitch.accidental && pitch.accidental === 'sharp') {
                accidental = '#';
              }
              if (pitch.accidental && pitch.accidental === 'flat') {
                accidental = 'b';
              }
              const no = computeNoteAndOctave(pitch.pitch);
              const noteName = no.note;
              const octave = no.octave;
              const noteBlob = {
                name: `${noteName}${accidental}${octave}`,
                duration,
                octave,
                line: staffNum,
              };
              reactronicaNotes.push(noteBlob);
            }
            notes[index] = reactronicaNotes;
          }
          if (note.endTriplet) {
            tripletMultiplier = 1;
          }
        }
        staffNum += 1;
      }
    }
    return notes;
  };

  React.useEffect(() => {
    if (notation) {
      const json = abcjs.parseOnly(notation);
      const noteList = parseJSON(json);
      console.log(noteList);
      const tune = abcjs.renderAbc('paper', notation, {
        add_classes: true,
        scale,
        staffwidth: 1200,
      });

      timer.current = new abcjs.TimingCallbacks(tune[0], {
        qpm: bpm,
        beatSubdivisions: 4,
        beatCallback: (beatNumber, totalBeats, totalTime) => {
          if (typeof onBeat === 'function') {
            onBeat(beatNumber, totalBeats, totalTime);
          }
        },
        lineEndCallback: info => {
          if (typeof onLineEnd === 'function') {
            onLineEnd(info);
          }
        },
        eventCallback: event => {
          if (typeof onEvent === 'function') {
            if (event === null) {
              onEvent(null);
            } else {
              // Event.midiPitches isn't working, so we need to work out pitch from ABC notation
              // const note = notation[event.startChar];
              // const note = notation.slice(event.startChar, event.endChar);
              const allNotes = event.startCharArray.map((_, index) => {
                const startChar = event.startCharArray[index];
                const endChar = event.endCharArray[index];
                return noteList[`s${startChar}e${endChar}`];
              });
              // now smoosh all the notes into one array and remove nulls (rests)
              const charNotes = []
                .concat(...allNotes)
                .filter(char => Boolean(char));
              if (typeof onEvent === 'function') {
                onEvent({
                  ...event,
                  notes: charNotes,
                });
              }

              // onEvent({
              //   ...event,
              //   note,
              // });
            }
          }

          if (!event) {
            return null;
          }

          // const notes = document.getElementsByClassName('abcjs-note');
          // const rests = document.getElementsByClassName('abcjs-rest');

          // for (let note of notes) {
          //   note.classList.remove('abcjs-note-playing');
          // }

          // for (let rest of rests) {
          //   rest.classList.remove('abcjs-note-playing');
          // }

          // event.elements.forEach(element => {
          //   element[0].classList.add('abcjs-note-playing');
          // });

          return null;
        },
      });
    }

    /* eslint-disable */
  }, [JSON.stringify(notation)]);
  /* eslint-enable */

  React.useEffect(() => {
    if (timer && timer.current) {
      if (isPlaying) {
        timer.current.start();
      } else {
        timer.current.stop();
      }
    }
  }, [isPlaying]);

  if (!notation) {
    return null;
  }

  return (
    <>
      <div
        id="paper"
        // ref={paper}
        className={className || ''}
      ></div>

      <style>
        {`
          #paper .abcjs-note, #paper .abcjs-rest {
            transition: 0.2s;
          }

          #paper .abcjs-note-playing {
            fill: #d10fc9;
          }
        `}
      </style>
    </>
  );
};

export default SheetMusic;
