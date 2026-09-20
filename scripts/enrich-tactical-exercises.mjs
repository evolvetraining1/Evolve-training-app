const families = {
  squat: {
    key_points: ["Pieds stables et complètement ancrés", "Genoux dans l’axe des orteils", "Tronc gainé et dos neutre"],
    common_errors: ["Laisser les genoux rentrer", "Décoller les talons", "Perdre le gainage du tronc"],
    regressions: ["Réduire la charge ou utiliser une box comme repère"],
    progressions: ["Augmenter progressivement la charge ou le tempo"],
  },
  hinge: {
    key_points: ["Hanches repoussées vers l’arrière", "Dos neutre et tronc gainé", "Charge maintenue proche du corps"],
    common_errors: ["Arrondir le bas du dos", "Transformer le mouvement en squat", "Éloigner la charge du corps"],
    regressions: ["Réduire la charge et limiter l’amplitude"],
    progressions: ["Ajouter une pause ou augmenter progressivement la charge"],
  },
  push: {
    key_points: ["Omoplates contrôlées", "Poignets alignés avec les avant-bras", "Tronc et bassin stables"],
    common_errors: ["Écarter excessivement les coudes", "Casser les poignets", "Compenser avec le bas du dos"],
    regressions: ["Réduire la charge ou choisir une variante plus stable"],
    progressions: ["Ajouter une pause ou augmenter progressivement la charge"],
  },
  pull: {
    key_points: ["Épaules loin des oreilles", "Coudes dirigés selon la trajectoire", "Retour lent et contrôlé"],
    common_errors: ["Hausser les épaules", "Donner de l’élan avec le buste", "Relâcher brutalement la phase retour"],
    regressions: ["Réduire la charge ou utiliser une assistance"],
    progressions: ["Ajouter une pause en fin de tirage ou du lest"],
  },
  core: {
    key_points: ["Bassin en position neutre", "Respiration régulière", "Tension continue de la sangle abdominale"],
    common_errors: ["Creuser le bas du dos", "Retenir la respiration", "Accélérer au détriment du contrôle"],
    regressions: ["Réduire l’amplitude ou la durée"],
    progressions: ["Augmenter progressivement l’amplitude, la durée ou la charge"],
  },
  conditioning: {
    key_points: ["Posture stable et relâchée", "Respiration régulière", "Cadence adaptée à l’objectif"],
    common_errors: ["Partir trop vite", "Dégrader la posture avec la fatigue", "Bloquer la respiration"],
    regressions: ["Réduire la cadence, la distance ou la durée"],
    progressions: ["Augmenter progressivement la durée ou l’intensité"],
  },
  plyo: {
    key_points: ["Impulsion complète", "Genoux dans l’axe des pieds", "Réception souple et contrôlée"],
    common_errors: ["Atterrir jambes tendues", "Laisser les genoux rentrer", "Choisir une hauteur excessive"],
    regressions: ["Réduire la hauteur ou remplacer le saut par un pas"],
    progressions: ["Augmenter progressivement la hauteur ou ajouter une charge légère"],
  },
  carry: {
    key_points: ["Posture haute et tronc gainé", "Épaules basses", "Pas courts et contrôlés"],
    common_errors: ["Se pencher sur un côté", "Hausser les épaules", "Marcher trop vite sans contrôle"],
    regressions: ["Réduire la charge ou la distance"],
    progressions: ["Augmenter progressivement la charge ou la distance"],
  },
  grip: {
    key_points: ["Poignets neutres et stables", "Épaules basses", "Prise maintenue sans appui extérieur"],
    common_errors: ["Casser excessivement les poignets", "Hausser les épaules", "Utiliser l’élan au lieu de contrôler la charge"],
    regressions: ["Réduire la charge ou la durée"],
    progressions: ["Augmenter progressivement la charge, la durée ou l’amplitude"],
  },
  isolation: {
    key_points: ["Articulation ciblée stable", "Amplitude contrôlée", "Phase retour lente"],
    common_errors: ["Utiliser de l’élan", "Choisir une charge trop lourde", "Raccourcir excessivement l’amplitude"],
    regressions: ["Réduire la charge ou l’amplitude"],
    progressions: ["Ajouter une pause ou ralentir la phase excentrique"],
  },
};

function exercise(name, family, instructions, objective, equipment, muscles, difficulty = "Intermédiaire") {
  return {
    name,
    instructions,
    objective,
    equipment,
    muscles,
    difficulty,
    ...families[family],
  };
}

const exercises = [
  exercise("Ab wheel", "core", "À genoux, saisis la roue sous les épaules. Rentre légèrement le bassin, gaine fort puis fais rouler la roue vers l’avant sans creuser le dos. Arrête l’amplitude avant de perdre la position et reviens en ramenant les côtes vers le bassin.", "Renforcer l’anti-extension du tronc et le contrôle lombo-pelvien.", ["Roue abdominale", "Tapis"], ["Abdominaux", "Grand dorsal", "Épaules"]),
  exercise("Adduction / Abduction", "isolation", "Règle la machine pour que les coussins soient confortablement placés contre les cuisses. Garde le bassin et le dos au dossier. Rapproche les jambes pour l’adduction ou écarte-les pour l’abduction, puis reviens lentement sans laisser les charges claquer.", "Renforcer les adducteurs et les abducteurs de hanche pour améliorer la stabilité du bassin.", ["Machine adducteurs-abducteurs"], ["Adducteurs", "Moyen fessier", "Petit fessier"], "Débutant"),
  exercise("Air squat", "squat", "Place les pieds légèrement plus larges que les hanches, pointes ouvertes. Descends en envoyant les hanches entre les talons, genoux dans l’axe des pieds et poitrine haute. Pousse le sol pour revenir debout en tendant complètement hanches et genoux.", "Maîtriser le schéma de squat au poids du corps et développer l’endurance des jambes.", ["Aucun"], ["Quadriceps", "Fessiers", "Adducteurs", "Gainage"], "Débutant"),
  exercise("Alternating DB hang snatch", "hinge", "Tiens un haltère entre les jambes, bras tendu. Depuis une charnière de hanche, étends rapidement les hanches puis guide l’haltère près du corps jusqu’au-dessus de la tête. Stabilise le bras tendu, redescends sous contrôle et change de côté.", "Développer puissance de hanche, coordination et stabilité au-dessus de la tête.", ["Haltère"], ["Fessiers", "Ischio-jambiers", "Épaules", "Gainage"]),
  exercise("Alternating gorilla row", "pull", "Place deux kettlebells entre les pieds et adopte une charnière de hanche stable. Tire une charge vers la hanche pendant que l’autre reste au sol, repose-la sous contrôle puis alterne sans faire pivoter le bassin.", "Renforcer le dos et l’anti-rotation dans un tirage alterné.", ["Deux kettlebells"], ["Grand dorsal", "Rhomboïdes", "Biceps", "Gainage"]),
  exercise("Alternating single arm incline DB bench press", "push", "Allonge-toi sur un banc incliné, pieds ancrés et omoplates serrées. Maintiens un haltère bras tendu pendant que l’autre descend vers le haut de la poitrine. Presse, stabilise puis alterne sans laisser le buste tourner.", "Renforcer le haut des pectoraux, les épaules et le contrôle anti-rotation.", ["Banc incliné", "Haltères"], ["Pectoraux supérieurs", "Triceps", "Deltoïdes antérieurs", "Gainage"]),
  exercise("Band bust rotation", "core", "Place-toi de profil par rapport à l’ancrage et tiens l’élastique à deux mains devant le sternum. Garde le bassin stable, tourne le thorax loin de l’ancrage puis reviens lentement sans tirer uniquement avec les bras.", "Développer le contrôle de la rotation du tronc.", ["Élastique", "Point d’ancrage"], ["Obliques", "Abdominaux", "Stabilisateurs du bassin"], "Débutant"),
  exercise("Band pull-apart", "pull", "Tiens l’élastique bras tendus devant les épaules. Écarte les mains en rapprochant les omoplates jusqu’à amener l’élastique vers la poitrine, puis reviens lentement sans hausser les épaules.", "Activer le haut du dos et améliorer le contrôle des omoplates.", ["Élastique"], ["Deltoïdes postérieurs", "Rhomboïdes", "Trapèzes"], "Débutant"),
  exercise("Barbell row", "pull", "Saisis la barre en pronation, pousse les hanches vers l’arrière et garde le dos neutre. Tire la barre vers le bas des côtes en ramenant les coudes derrière toi. Marque une courte pause puis redescends sans modifier l’angle du buste.", "Développer la force du dos et la stabilité de la charnière de hanche.", ["Barre", "Disques"], ["Grand dorsal", "Rhomboïdes", "Biceps", "Érecteurs du rachis"]),
  exercise("Bear crawl", "core", "Place-toi à quatre appuis, mains sous les épaules et genoux sous les hanches. Décolle légèrement les genoux puis avance main et pied opposés par petits pas, bassin bas et dos stable.", "Renforcer le gainage dynamique et la coordination croisée.", ["Aucun"], ["Abdominaux", "Épaules", "Quadriceps", "Stabilisateurs du bassin"], "Débutant"),
  exercise("Behind-the-neck DB press", "push", "Assis ou debout, tiens un haltère verticalement derrière la tête, coudes orientés vers l’avant. Étends les coudes pour monter la charge au-dessus de la tête puis redescends jusqu’à une amplitude confortable sans avancer la tête ni cambrer.", "Renforcer les triceps et le contrôle de la poussée au-dessus de la tête.", ["Haltère"], ["Triceps", "Épaules", "Gainage"]),
  exercise("Bike", "conditioning", "Règle la selle à hauteur de hanche. Garde le buste solide, pousse et tire les poignées en coordination avec les jambes. Maintiens les genoux dans l’axe et une cadence régulière adaptée à l’effort.", "Développer la capacité cardio-respiratoire avec un effort global sans impact.", ["Assault Bike"], ["Quadriceps", "Fessiers", "Épaules", "Bras", "Cardio"]),
  exercise("Box jump", "plyo", "Place-toi à une courte distance de la box. Fléchis légèrement hanches et genoux, balance les bras puis saute à deux pieds. Réceptionne-toi souplement sur la box, stabilise et redescends avec contrôle.", "Développer la puissance des membres inférieurs et la qualité de réception.", ["Box"], ["Quadriceps", "Fessiers", "Mollets"]),
  exercise("Box jump over", "plyo", "Saute à deux pieds sur la box, réceptionne avec les genoux souples puis franchis-la pour descendre de l’autre côté. Tourne-toi seulement lorsque les appuis sont stables et enchaîne avec contrôle.", "Développer puissance, coordination et capacité à franchir un obstacle.", ["Box"], ["Quadriceps", "Fessiers", "Mollets", "Cardio"]),
  exercise("Box step-over", "squat", "Monte un pied entièrement sur la box, pousse dans ce pied pour passer au-dessus puis pose le second pied de l’autre côté. Garde le bassin stable et évite de te propulser avec la jambe restée au sol.", "Renforcer les jambes de façon unilatérale et améliorer la stabilité du bassin.", ["Box", "Haltères facultatifs"], ["Quadriceps", "Fessiers", "Ischio-jambiers"]),
  exercise("Bulgarian split squat", "squat", "Place le dessus du pied arrière sur un banc et le pied avant assez loin pour rester stable. Descends verticalement jusqu’à une amplitude confortable, genou avant dans l’axe, puis pousse dans le pied avant pour remonter.", "Développer la force unilatérale des jambes et la stabilité du bassin.", ["Banc"], ["Quadriceps", "Fessiers", "Adducteurs"]),
  exercise("Burpee", "conditioning", "Depuis la position debout, pose les mains au sol et envoie les pieds en arrière jusqu’à amener poitrine et cuisses au sol. Ramène les pieds près des mains, relève-toi puis termine par un petit saut contrôlé avec les mains au-dessus de la tête.", "Développer l’endurance globale et la capacité à passer rapidement du sol à la position debout.", ["Aucun"], ["Pectoraux", "Triceps", "Quadriceps", "Fessiers", "Cardio"]),
  exercise("Chest-supported DB row", "pull", "Allonge la poitrine sur un banc incliné et laisse les haltères pendre sous les épaules. Tire les coudes vers les hanches en rapprochant les omoplates, marque une pause puis redescends lentement.", "Renforcer le dos en limitant les compensations lombaires.", ["Banc incliné", "Haltères"], ["Grand dorsal", "Rhomboïdes", "Deltoïdes postérieurs", "Biceps"]),
  exercise("Copenhagen plank", "core", "Place l’avant-bras au sol et la jambe supérieure sur un banc. Soulève le bassin pour aligner épaules, hanches et chevilles, puis rapproche la jambe inférieure de la jambe supérieure sans tourner le bassin.", "Renforcer les adducteurs et le gainage latéral.", ["Banc", "Tapis"], ["Adducteurs", "Obliques", "Moyen fessier"], "Avancé"),
  exercise("DB bench press", "push", "Allonge-toi sur un banc, pieds ancrés et omoplates serrées. Descends les haltères de part et d’autre de la poitrine avec les coudes à environ 45°, puis presse-les jusqu’à tendre les bras sans perdre la position du haut du dos.", "Renforcer les pectoraux, les triceps et la stabilité des épaules.", ["Banc", "Haltères"], ["Pectoraux", "Triceps", "Deltoïdes antérieurs"]),
  exercise("DB Bulgarian split squat", "squat", "Tiens un haltère dans chaque main, pied arrière sur un banc et pied avant stable. Descends verticalement en contrôlant le genou avant, puis pousse dans le pied avant pour revenir en position haute.", "Développer la force unilatérale des jambes avec charge.", ["Banc", "Haltères"], ["Quadriceps", "Fessiers", "Adducteurs"]),
  exercise("DB clean and jerk", "hinge", "Depuis les haltères au sol ou en position suspendue, étends rapidement les hanches pour les recevoir aux épaules. Fléchis légèrement les jambes puis pousse fort pour verrouiller les haltères au-dessus de la tête. Stabilise avant de redescendre.", "Développer puissance globale, coordination et stabilité au-dessus de la tête.", ["Haltères"], ["Fessiers", "Quadriceps", "Épaules", "Triceps", "Gainage"], "Avancé"),
  exercise("DB deadlift", "hinge", "Place les haltères de chaque côté des jambes. Repousse les hanches, fléchis légèrement les genoux et garde le dos neutre. Pousse le sol pour te redresser en gardant les charges proches du corps, puis redescends sous contrôle.", "Renforcer la chaîne postérieure avec une charge facile à positionner.", ["Haltères"], ["Fessiers", "Ischio-jambiers", "Quadriceps", "Dos"]),
  exercise("DB front squat", "squat", "Place les haltères sur les épaules, coudes légèrement vers l’avant. Inspire, gaine puis descends entre les talons avec la poitrine haute. Pousse le sol pour revenir debout sans laisser les genoux rentrer.", "Renforcer les jambes et le gainage en charge antérieure.", ["Haltères"], ["Quadriceps", "Fessiers", "Adducteurs", "Gainage"]),
  exercise("DB lateral raise", "isolation", "Debout, haltères le long du corps et coudes légèrement fléchis. Lève les bras dans le plan des omoplates jusqu’à hauteur d’épaules, puis redescends lentement sans hausser les épaules.", "Renforcer le deltoïde moyen et améliorer le contrôle de l’épaule.", ["Haltères"], ["Deltoïdes moyens", "Stabilisateurs de l’épaule"], "Débutant"),
  exercise("DB Romanian deadlift", "hinge", "Tiens les haltères devant les cuisses. Garde les genoux légèrement fléchis, pousse les hanches loin derrière et fais glisser les charges près des jambes. Arrête-toi lorsque les ischio-jambiers sont en tension puis serre les fessiers pour remonter.", "Renforcer les ischio-jambiers et les fessiers avec une charnière de hanche contrôlée.", ["Haltères"], ["Ischio-jambiers", "Fessiers", "Érecteurs du rachis"]),
  exercise("DB skull crusher", "isolation", "Allonge-toi sur un banc, haltères au-dessus des épaules et paumes face à face. Garde les bras supérieurs fixes, fléchis les coudes pour descendre les charges près des tempes puis tends les coudes sans les écarter.", "Renforcer les triceps avec un travail d’extension du coude.", ["Banc", "Haltères"], ["Triceps"]),
  exercise("DB thruster", "squat", "Tiens les haltères sur les épaules. Descends en squat puis remonte puissamment en utilisant l’extension des jambes pour propulser les haltères au-dessus de la tête. Verrouille les bras et stabilise avant de redescendre.", "Développer la puissance et l’endurance globale en combinant squat et poussée.", ["Haltères"], ["Quadriceps", "Fessiers", "Épaules", "Triceps", "Cardio"]),
  exercise("Dead bug", "core", "Allonge-toi sur le dos, hanches et genoux à 90°, bras vers le plafond. Plaque doucement le bas du dos au sol puis tends lentement une jambe et le bras opposé. Reviens au centre et alterne sans perdre le contact lombaire.", "Améliorer le contrôle lombo-pelvien et la coordination croisée.", ["Tapis"], ["Abdominaux profonds", "Fléchisseurs de hanche", "Gainage lombaire"], "Débutant"),
  exercise("Death by burpees", "conditioning", "Réalise un burpee pendant la première minute, deux pendant la deuxième, puis ajoute une répétition à chaque nouvelle minute. Utilise le temps restant pour récupérer et arrête lorsque le nombre demandé ne peut plus être terminé proprement.", "Tester et développer la capacité à maintenir un effort croissant.", ["Chronomètre"], ["Corps entier", "Cardio"], "Avancé"),
  exercise("Devil press", "conditioning", "Avec un haltère dans chaque main, réalise un burpee poitrine au sol entre les charges. Ramène les pieds, étends puissamment les hanches puis guide les haltères en un mouvement continu jusqu’au-dessus de la tête. Stabilise avant de redescendre.", "Développer puissance, endurance et coordination dans un mouvement complet.", ["Haltères"], ["Fessiers", "Ischio-jambiers", "Épaules", "Triceps", "Cardio"], "Avancé"),
  exercise("Face pull", "pull", "Fixe une corde ou un élastique à hauteur du visage. Tire vers le front en séparant les mains et en gardant les coudes hauts. Termine avec les omoplates rapprochées et les avant-bras verticaux, puis reviens lentement.", "Renforcer le haut du dos et les rotateurs externes de l’épaule.", ["Poulie ou élastique", "Corde"], ["Deltoïdes postérieurs", "Rhomboïdes", "Trapèzes", "Coiffe des rotateurs"], "Débutant"),
  exercise("Farmer carry", "carry", "Saisis une charge lourde dans chaque main, redresse-toi avec le dos neutre puis marche par petits pas. Garde la tête haute, les épaules basses et les charges stables près des cuisses jusqu’à la fin de la distance.", "Développer la force de préhension, le gainage et la capacité de portage.", ["Haltères ou kettlebells"], ["Avant-bras", "Trapèzes", "Gainage", "Jambes"]),
  exercise("Goblet squat", "squat", "Tiens une kettlebell ou un haltère contre la poitrine. Descends entre les talons, coudes proches du buste, genoux dans l’axe et poitrine haute. Pousse le sol pour revenir debout en serrant les fessiers.", "Apprendre et renforcer le squat avec une charge antérieure.", ["Kettlebell ou haltère"], ["Quadriceps", "Fessiers", "Adducteurs", "Gainage"], "Débutant"),
  exercise("Hanging knee raise", "core", "Suspends-toi bras tendus et stabilise les épaules. Sans te balancer, rétroverse légèrement le bassin puis monte les genoux vers la poitrine. Redescends lentement jusqu’à retrouver une suspension stable.", "Renforcer les abdominaux et contrôler le bassin en suspension.", ["Barre de traction"], ["Abdominaux", "Fléchisseurs de hanche", "Avant-bras"]),
  exercise("Hollow hold", "core", "Allonge-toi sur le dos, plaque les lombaires au sol puis décolle épaules et jambes. Tends les bras dans le prolongement du corps selon ton niveau et maintiens la position sans laisser le dos se creuser.", "Développer un gainage antérieur solide en position creuse.", ["Tapis"], ["Abdominaux", "Fléchisseurs de hanche"], "Débutant"),
  exercise("Incline curl", "isolation", "Assieds-toi sur un banc incliné, bras pendants et paumes vers l’avant. Garde les épaules en arrière, fléchis les coudes sans les avancer puis redescends complètement sous contrôle.", "Renforcer les biceps sur une grande amplitude.", ["Banc incliné", "Haltères"], ["Biceps", "Brachial", "Avant-bras"]),
  exercise("Incline DB bench press", "push", "Allonge-toi sur un banc incliné, pieds ancrés et omoplates serrées. Descends les haltères vers le haut de la poitrine avec les coudes à environ 45°, puis presse jusqu’à tendre les bras.", "Renforcer le haut des pectoraux, les triceps et les épaules.", ["Banc incliné", "Haltères"], ["Pectoraux supérieurs", "Triceps", "Deltoïdes antérieurs"]),
  exercise("Incline run", "conditioning", "Sur tapis incliné, garde le buste légèrement penché depuis les chevilles et pose le pied sous le centre de gravité. Utilise des foulées courtes, des bras actifs et une cadence régulière sans te tenir aux poignées.", "Développer la puissance aérobie et l’endurance des jambes en côte.", ["Tapis de course incliné"], ["Mollets", "Quadriceps", "Fessiers", "Cardio"]),
  exercise("Jumping lunge", "plyo", "Depuis une fente stable, pousse fort dans les deux jambes pour sauter et changer leur position en l’air. Réceptionne en fente avec les genoux souples puis enchaîne en conservant le buste haut.", "Développer puissance unilatérale, coordination et endurance des jambes.", ["Aucun"], ["Quadriceps", "Fessiers", "Mollets", "Cardio"]),
  exercise("KB Russian twist", "core", "Assieds-toi, buste légèrement incliné et dos long. Tiens la kettlebell devant la poitrine puis tourne les côtes d’un côté à l’autre en gardant le bassin stable. Pose ou approche la charge du sol sans arrondir le dos.", "Renforcer les obliques et contrôler la rotation du tronc.", ["Kettlebell", "Tapis"], ["Obliques", "Abdominaux", "Fléchisseurs de hanche"]),
  exercise("Kettlebell deadlift", "hinge", "Place la kettlebell entre les pieds. Repousse les hanches, fléchis légèrement les genoux et saisis la poignée avec le dos neutre. Pousse le sol et tends les hanches pour te redresser, puis repose la charge sous contrôle.", "Apprendre la charnière de hanche et renforcer la chaîne postérieure.", ["Kettlebell"], ["Fessiers", "Ischio-jambiers", "Quadriceps", "Dos"], "Débutant"),
  exercise("Kettlebell swing", "hinge", "Place la kettlebell devant toi, saisis-la et ramène-la entre les jambes. Étends vivement les hanches pour faire flotter la charge jusqu’à hauteur de poitrine, bras relâchés, puis absorbe le retour en repoussant les hanches.", "Développer la puissance de hanche et l’endurance de la chaîne postérieure.", ["Kettlebell"], ["Fessiers", "Ischio-jambiers", "Gainage", "Cardio"]),
  exercise("Landmine press", "push", "Place l’extrémité de la barre à hauteur d’épaule et tiens-la d’une main. Gaine le tronc puis presse la barre vers l’avant et le haut sans tourner le bassin. Redescends lentement jusqu’à l’épaule.", "Renforcer l’épaule dans une trajectoire diagonale tolérante.", ["Barre", "Support landmine", "Disques"], ["Deltoïdes", "Triceps", "Pectoraux", "Gainage"]),
  exercise("Oblique flexion", "core", "Debout avec une charge dans une main, garde les hanches face devant. Incline lentement le buste du côté de la charge puis contracte le côté opposé pour revenir droit sans tourner le tronc.", "Renforcer les obliques et la stabilité latérale du tronc.", ["Haltère ou disque"], ["Obliques", "Carré des lombes"]),
  exercise("Plate pinch hold", "grip", "Pince un ou deux disques entre les doigts et le pouce, bras le long du corps. Tiens-toi droit, épaules basses, et maintiens la prise sans appuyer le disque contre la cuisse.", "Développer la force de pince des doigts et des avant-bras.", ["Disques"], ["Avant-bras", "Main et doigts", "Trapèzes"]),
  exercise("Pull-up", "pull", "Suspends-toi en prise pronation, bras tendus et corps gainé. Abaisse les omoplates puis tire les coudes vers le sol jusqu’à amener le menton au-dessus de la barre. Redescends sous contrôle jusqu’aux bras tendus.", "Développer la force relative du dos et des bras.", ["Barre de traction"], ["Grand dorsal", "Biceps", "Rhomboïdes", "Gainage"]),
  exercise("Rear delt DB raise", "isolation", "Incline le buste avec le dos neutre et tiens les haltères sous les épaules. Écarte les bras jusqu’à aligner les coudes avec les épaules, marque une pause puis redescends lentement sans hausser les épaules.", "Renforcer les deltoïdes postérieurs et le haut du dos.", ["Haltères"], ["Deltoïdes postérieurs", "Rhomboïdes", "Trapèzes"]),
  exercise("Run", "conditioning", "Cours avec le buste haut et légèrement incliné depuis les chevilles. Pose le pied sous le centre de gravité, garde les bras relâchés près de 90° et maintiens une foulée régulière adaptée à l’allure.", "Développer l’endurance cardio-respiratoire et l’efficacité de course.", ["Chaussures de course"], ["Jambes", "Gainage", "Cardio"], "Débutant"),
  exercise("Scapular push-up", "push", "En position de planche bras tendus, garde les coudes verrouillés. Laisse la poitrine descendre légèrement entre les épaules en rapprochant les omoplates, puis pousse le sol pour les écarter au maximum sans bouger le bassin.", "Améliorer le contrôle des omoplates et activer le dentelé antérieur.", ["Tapis"], ["Dentelé antérieur", "Stabilisateurs des épaules", "Gainage"], "Débutant"),
  exercise("Side plank", "core", "Place l’avant-bras au sol, coude sous l’épaule et pieds empilés. Soulève le bassin jusqu’à aligner tête, épaules, hanches et chevilles. Maintiens sans tourner le buste ni laisser le bassin descendre.", "Renforcer le gainage latéral et la stabilité du bassin.", ["Tapis"], ["Obliques", "Moyen fessier", "Stabilisateurs de l’épaule"], "Débutant"),
  exercise("Single leg GHD hip extension", "hinge", "Installe-toi sur le GHD avec le bassin soutenu et une seule jambe active. Fléchis à la hanche avec le dos neutre puis contracte le fessier et l’ischio-jambier de la jambe d’appui pour revenir dans l’alignement.", "Renforcer unilatéralement les fessiers et les ischio-jambiers.", ["GHD"], ["Fessiers", "Ischio-jambiers", "Érecteurs du rachis"]),
  exercise("Single leg hamstring curl", "isolation", "Place une jambe sous le rouleau de la machine et garde le bassin stable. Fléchis le genou pour rapprocher le talon de la fesse, marque une pause puis redescends lentement sans verrouiller brutalement.", "Renforcer les ischio-jambiers de manière unilatérale.", ["Machine à leg curl"], ["Ischio-jambiers", "Mollets"], "Débutant"),
  exercise("Single unders", "conditioning", "Tiens les poignées près des hanches, coudes proches du corps. Fais tourner la corde avec les poignets et réalise de petits sauts verticaux sur l’avant-pied, un passage de corde par saut.", "Développer coordination, rythme et endurance des mollets.", ["Corde à sauter"], ["Mollets", "Avant-bras", "Cardio"], "Débutant"),
  exercise("Standing curl", "isolation", "Debout, tiens les haltères paumes vers l’avant et coudes proches du buste. Fléchis les coudes sans balancer le corps, serre les biceps puis redescends complètement sous contrôle.", "Renforcer les biceps et les fléchisseurs du coude.", ["Haltères"], ["Biceps", "Brachial", "Avant-bras"], "Débutant"),
  exercise("Strict press", "push", "Place la barre sur le haut de la poitrine, mains légèrement plus larges que les épaules. Gaine fortement, recule légèrement la tête puis presse verticalement sans utiliser les jambes. Termine bras tendus au-dessus du milieu du pied.", "Développer la force de poussée verticale et la stabilité du tronc.", ["Barre", "Disques"], ["Deltoïdes", "Triceps", "Haut des pectoraux", "Gainage"]),
  exercise("Superman plank hold", "core", "Depuis une planche solide, tends simultanément un bras devant toi et la jambe opposée derrière. Garde le bassin parallèle au sol, maintiens brièvement puis repose les appuis avec contrôle avant d’alterner.", "Renforcer l’anti-rotation et la stabilité globale du tronc.", ["Tapis"], ["Abdominaux", "Fessiers", "Érecteurs du rachis", "Épaules"], "Avancé"),
  exercise("Thruster", "squat", "Place la barre sur les épaules, descends en front squat puis remonte puissamment. Utilise l’extension des jambes pour propulser la barre au-dessus de la tête et termine bras tendus avant de la ramener aux épaules.", "Développer puissance et endurance globale en combinant squat et poussée.", ["Barre", "Disques"], ["Quadriceps", "Fessiers", "Épaules", "Triceps", "Cardio"]),
  exercise("Toes-to-bar", "core", "Suspends-toi en prise pronation et crée un balancement contrôlé depuis les épaules. Engage les abdominaux, monte les jambes jusqu’à toucher la barre avec les pieds puis reviens en position creuse sans perdre le rythme.", "Développer la force du tronc et la coordination en suspension.", ["Barre de traction"], ["Abdominaux", "Fléchisseurs de hanche", "Grand dorsal", "Avant-bras"], "Avancé"),
  exercise("Weighted box jump", "plyo", "Porte un gilet lesté léger, place-toi face à la box puis saute à deux pieds. Réceptionne-toi souplement, stabilise complètement sur la box et redescends en marchant. La charge ne doit jamais dégrader la réception.", "Développer la puissance des jambes sous légère surcharge.", ["Box", "Gilet lesté"], ["Quadriceps", "Fessiers", "Mollets"], "Avancé"),
  exercise("Weighted pull-up", "pull", "Fixe le lest de façon stable puis suspends-toi en prise pronation. Gaine le corps, abaisse les omoplates et tire jusqu’à placer le menton au-dessus de la barre. Redescends lentement jusqu’aux bras tendus.", "Développer la force maximale en traction verticale.", ["Barre de traction", "Ceinture ou gilet lesté"], ["Grand dorsal", "Biceps", "Rhomboïdes", "Gainage"], "Avancé"),
  exercise("Wrist roller", "grip", "Tiens le rouleau bras tendus devant toi et épaules basses. Enroule la corde en alternant les poignets jusqu’à faire monter la charge, puis déroule-la lentement sans la laisser tomber.", "Renforcer les avant-bras, les poignets et la force de préhension.", ["Wrist roller", "Disque"], ["Fléchisseurs des avant-bras", "Extenseurs des avant-bras", "Grip"]),
];

const payload = JSON.stringify(exercises);

if (payload.includes("$exercise_library$")) {
  throw new Error("Exercise metadata contains the SQL dollar-quote delimiter.");
}

process.stdout.write(`
begin;

with source as (
  select *
  from jsonb_to_recordset($exercise_library$${payload}$exercise_library$::jsonb) as item(
    name text,
    instructions text,
    objective text,
    key_points jsonb,
    common_errors jsonb,
    regressions jsonb,
    progressions jsonb,
    equipment jsonb,
    muscles jsonb,
    difficulty text
  )
)
update public.exercises target
set
  instructions = source.instructions,
  objective = source.objective,
  key_points = array(select jsonb_array_elements_text(source.key_points)),
  common_errors = array(select jsonb_array_elements_text(source.common_errors)),
  regressions = array(select jsonb_array_elements_text(source.regressions)),
  progressions = array(select jsonb_array_elements_text(source.progressions)),
  equipment = array(select jsonb_array_elements_text(source.equipment)),
  muscles = array(select jsonb_array_elements_text(source.muscles)),
  difficulty = source.difficulty,
  updated_at = now()
from source
where lower(target.name) = lower(source.name)
  and nullif(trim(target.instructions), '') is null;

commit;

select
  count(*) filter (where nullif(trim(e.instructions), '') is null) as missing_description,
  count(*) filter (where nullif(trim(e.instructions), '') is not null) as complete_description
from public.programs p
join public.workout_templates wt on wt.program_id = p.id
join public.workout_exercises we on we.workout_template_id = wt.id
join public.exercises e on e.id = we.exercise_id
where upper(p.name) = 'TACTICAL RECONDITIONING';
`.trimStart());
