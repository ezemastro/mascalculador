import { useLocation } from "react-router";
import MainLayout from "../components/MainLayout";
import { Coordinates, Mafs, Plot, Vector } from "mafs";

export default function ResultsPage() {
  const location = useLocation();
  const { loads } = location.state as { loads: Load[] };

  const sections = [
    ...loads.flatMap((load) => {
      if (load.type === "point") {
        return [load.position || 0];
      } else if (load.type === "distributed") {
        return [load.start || 0, load.end || 0];
      }
      return [];
    }),
    0,
  ]
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort((a, b) => a - b);
  console.log(sections);

  return (
    <MainLayout>
      <h1 className="text-2xl font-bold">Results Page</h1>
      <h2 className="text-2xl font-bold">Carga</h2>
      <Mafs>
        <Coordinates.Cartesian />
        {loads.map((load: Load) => (
          <>
            {load.type === "point" && (
              <Vector
                key={load.id}
                tip={[load.position || 0, 0]}
                tail={[load.position || 0, load.magnitude]}
              />
            )}
            {load.type === "distributed" && (
              <>
                <Plot.OfX
                  key={load.id}
                  y={() => load.magnitude}
                  domain={[load.start || 0, load.end || 0]}
                />
                <Plot.OfY
                  key={load.id + "start"}
                  x={() => load.start || 0}
                  domain={[0, load.magnitude || 0]}
                />
                <Plot.OfY
                  key={load.id + "end"}
                  x={() => load.end || 0}
                  domain={[0, load.magnitude || 0]}
                />
              </>
            )}
          </>
        ))}
      </Mafs>
      <h2 className="text-2xl font-bold">Integral</h2>
      <Mafs zoom={true}>
        <Coordinates.Cartesian />
        {sections.map((section, index) => {
          // Cargas distribuidas que contienen esta seccion
          const distributedLoads = loads.filter((load) => {
            if (load.type === "distributed") {
              return (load.start || 0) < section && (load.end || 0) >= section;
            }
            return false;
          });
          // Sumar magnitudes de cargas distribuidas
          const sectionMagnitude = distributedLoads.reduce(
            (acc, load) => acc + (load.magnitude || 0),
            0,
          );
          // Cargas puntuales dentro de esta seccion
          const pointLoads = loads.filter((load) => {
            if (load.type === "point") {
              return (load.position || 0) === section;
            }
            return false;
          });
          // Sumar magnitudes de cargas puntuales
          const pointMagnitude = pointLoads.reduce(
            (acc, load) => acc + (load.magnitude || 0),
            0,
          );
          // Hallar valor inicial de la sección en Y
          // Cargas antes de esta seccion
          const previousLoads = loads.filter((load) => {
            if (load.type === "point") {
              return (load.position || 0) <= (sections[index - 1] || 0);
            } else if (load.type === "distributed") {
              return (load.end || 0) <= (sections[index - 1] || 0);
            }
            return false;
          });
          // Sumar sus integrales
          const initialValue = previousLoads.reduce((acc, load) => {
            if (load.type === "point") {
              return acc + (load.magnitude || 0);
            } else if (load.type === "distributed") {
              const length = (load.end || 0) - (load.start || 0);
              return acc + (load.magnitude || 0) * length;
            }
            return acc;
          }, 0);

          // Obtener valor inicial de la sección en X
          const initialX = sections[index - 1] || 0;

          const endY = sectionMagnitude * (section - initialX) + initialValue;
          return (
            <>
              {/* Graficar integral de la sección */}
              <Plot.OfX
                key={section + "x"}
                y={(x) => {
                  // Integrar la sección
                  const relativeX = x - initialX;
                  const y = sectionMagnitude * relativeX;

                  return y + initialValue;
                }}
                domain={[sections[index - 1] || 0, section]}
              />
              {/* Graficar cargas puntuales */}
              <Plot.OfY
                key={section + "y"}
                x={() => section}
                domain={[endY, endY + pointMagnitude]}
              />
            </>
          );
        })}

        {/* <Text x={-l / 2} y={-Ra} attach="w" attachDistance={10}>
          Ra = {Ra.toFixed(2)}
        </Text>
        <Text x={l / 2} y={Rb} attach="e" attachDistance={10}>
          Rb = {Rb.toFixed(2)}
        </Text> */}
      </Mafs>
      <h2 className="text-2xl font-bold">Momento</h2>
      <Mafs>
        <Coordinates.Cartesian />
        {/* <Text x={0} y={-Mmax} attach="s" attachDistance={-10}>
          Mmax = {Mmax.toFixed(2)}
        </Text> */}
      </Mafs>
    </MainLayout>
  );
}
