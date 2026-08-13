import React, { createContext, useContext, useMemo, useState } from "react";
import { exercises as seed, Exercise } from "@/src/data/mock";

type SessionContextValue = {
  exercises: Exercise[];
  completed: boolean;
  updateSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<Exercise["sets"][number]>
  ) => void;
  completeSession: () => void;
  totalVolume: number;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [exercises, setExercises] = useState<Exercise[]>(seed);
  const [completed, setCompleted] = useState(false);

  const updateSet: SessionContextValue["updateSet"] = (
    exerciseId,
    setId,
    patch
  ) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, ...patch } : set
              ),
            }
      )
    );
  };

  const totalVolume = useMemo(
    () =>
      exercises.reduce(
        (sum, ex) =>
          sum +
          ex.sets.reduce(
            (sub, set) => sub + (set.done ? set.reps * set.load : 0),
            0
          ),
        0
      ),
    [exercises]
  );

  return (
    <SessionContext.Provider
      value={{
        exercises,
        completed,
        updateSet,
        completeSession: () => setCompleted(true),
        totalVolume,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
